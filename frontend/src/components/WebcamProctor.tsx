// src/components/WebcamProctor.tsx
import { useEffect, useRef, useState } from "react";
import * as tf from "@tensorflow/tfjs";
import * as blazeface from "@tensorflow-models/blazeface";
import * as cocoSsd from "@tensorflow-models/coco-ssd";
import client from "../api/axiosClient";
import "../styles/webcamProctor.css";

const FRAME_INTERVAL_MS = 1200; 
const AGGREGATION_WINDOW_MS = 30_000; 

function nowIso() {
  return new Date().toISOString();
}

type WebcamProctorProps = {
  sessionId: number | null;
  onAnomaly?: (a: any) => void; 
  onAnomalyAggregated?: (agg: any[]) => void;
  onCameraStatusChange?: (on: boolean) => void;
};

const WebcamProctor: React.FC<WebcamProctorProps> = ({
  sessionId,
  onAnomaly,
  onAnomalyAggregated,
  onCameraStatusChange,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<number | null>(null);

  const faceModelRef = useRef<any>(null);
  const phoneModelRef = useRef<any>(null);

  const batchMapRef = useRef<Record<string, any>>({});
  const flushTimerRef = useRef<number | null>(null);

  const [cameraOn, setCameraOn] = useState(false);
  const [modelsReady, setModelsReady] = useState(false);
  const [loadingModels, setLoadingModels] = useState(true);

  // Load models
  useEffect(() => {
    let mounted = true;
    const loadModels = async () => {
      try {
        await tf.ready();
        const faceModel = await blazeface.load();
        const phoneModel = await cocoSsd.load();
        if (!mounted) return;
        faceModelRef.current = faceModel;
        phoneModelRef.current = phoneModel;
        setModelsReady(true);
      } catch (err) {
        console.error("Error loading TF.js models", err);
      } finally {
        if (mounted) setLoadingModels(false);
      }
    };
    loadModels();
    return () => {
      mounted = false;
    };
  }, []);

  // Start/stop camera
  const startCamera = async () => {
    if (!modelsReady) {
      console.warn("Models not ready yet");
      return;
    }
    if (!sessionId) {
      console.warn("No sessionId yet — cannot start proctoring until exam started.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);
      onCameraStatusChange?.(true);
      startFrameLoop();
      startFlushTimer(); // start 30s aggregation timer
    } catch (err) {
      console.error("Error starting camera", err);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraOn(false);
    onCameraStatusChange?.(false);
    stopFrameLoop();
    stopFlushTimer();
    // flush any remaining batch immediately when camera stops
    flushBatch().catch((e) => console.error("flushBatch on stop failed:", e));
  };

  // frame loop
  const startFrameLoop = () => {
    if (intervalRef.current != null) return;
    intervalRef.current = window.setInterval(() => captureAndAnalyzeFrame(), FRAME_INTERVAL_MS);
  };
  const stopFrameLoop = () => {
    if (intervalRef.current != null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  // flush timer
  const startFlushTimer = () => {
    if (flushTimerRef.current != null) return;
    flushTimerRef.current = window.setInterval(() => {
      flushBatch().catch((e) => console.error("flushBatch failed:", e));
    }, AGGREGATION_WINDOW_MS);
  };
  const stopFlushTimer = () => {
    if (flushTimerRef.current != null) {
      clearInterval(flushTimerRef.current);
      flushTimerRef.current = null;
    }
  };

  // capture & analyze
  const captureAndAnalyzeFrame = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    if (!video.videoWidth || !video.videoHeight) return;
    if (!faceModelRef.current || !phoneModelRef.current) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    try {
      const anomalies = await detectAnomaliesOnFrame(canvas, faceModelRef.current, phoneModelRef.current);

      if (anomalies.length) {
        for (const a of anomalies) {
          addToBatch(a.event_type, a.message, a.timestamp);
          onAnomaly?.({
            anomaly_type: a.event_type,
            details: a.message,
            timestamp: a.timestamp,
          });
        }
      }
    } catch (err) {
      console.error("Error analyzing frame", err);
    }
  };

  // Adds raw anomaly into in-memory batch
  const addToBatch = (eventType: string, message: string, timestamp: string) => {
    const map = batchMapRef.current;
    if (!map[eventType]) {
      map[eventType] = { count: 0, first_ts: timestamp, last_ts: timestamp };
    }
    map[eventType].count += 1;
    map[eventType].last_ts = timestamp;
  };

  // flush batch to backend
  const flushBatch = async () => {
    const map = batchMapRef.current;
    const keys = Object.keys(map);
    if (keys.length === 0) return; // nothing to do

    // prepare events array
    const events = keys.map((k) => ({
      event_type: k,
      count: map[k].count,
      first_ts: map[k].first_ts,
      last_ts: map[k].last_ts,
    }));

    // reset batch map immediately
    batchMapRef.current = {};

    if (!sessionId) return;

    try {
      const payload = {
        exam_id: sessionId, // <-- use sessionId here
        events,
      };
      // IMPORTANT: do not prefix with /api (axios baseURL already includes it)
      const res = await client.post("/proctor/anomaly/batch/", payload);
      if (res && res.data) {
        onAnomalyAggregated?.(res.data.aggregates || []);
      }
    } catch (err) {
      console.error("Error flushing anomaly batch", err);
    }
  };

  // detection logic
  const detectAnomaliesOnFrame = async (canvas: HTMLCanvasElement, faceModel: any, phoneModel: any) => {
    const anomalies: { event_type: string; message: string; timestamp: string }[] = [];
    const timestamp = nowIso();

    const tfImg = tf.browser.fromPixels(canvas);
    const faces = await faceModel.estimateFaces(tfImg, false);
    tfImg.dispose();

    const faceCount = Array.isArray(faces) ? faces.length : 0;

    if (faceCount === 0) {
      anomalies.push({ event_type: "no_face", message: "No face detected in frame", timestamp });
    } else if (faceCount > 1) {
      anomalies.push({ event_type: "multiple_faces", message: `${faceCount} faces detected in frame`, timestamp });
    }

    if (faceCount === 1) {
      const f = faces[0];
      const topLeft = f.topLeft || f[0];
      const bottomRight = f.bottomRight || f[1];
      const [x1, y1] = topLeft;
      const [x2, y2] = bottomRight;
      const boxWidth = x2 - x1;
      const boxHeight = y2 - y1;
      if (boxWidth < canvas.width * 0.15 || boxHeight < canvas.height * 0.15) {
        anomalies.push({ event_type: "looking_away", message: "User may be far or turned away", timestamp });
      }
    }

    const preds = await phoneModel.detect(canvas);
    const phoneDetected = preds.some((p: any) => (p.class === "cell phone" || p.class === "mobile phone" || p.class === "phone") && p.score > 0.6);
    if (phoneDetected) {
      anomalies.push({ event_type: "phone_detected", message: "Possible mobile phone detected", timestamp });
    }

    return anomalies;
  };

  // cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
      stopFrameLoop();
      stopFlushTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="webcam-proctor">
      <div className="webcam-proctor__header">
        <h4>Live Camera</h4>
        {loadingModels && <span className="webcam-proctor__status">Loading ML…</span>}
        {!loadingModels && !modelsReady && (
          <span className="webcam-proctor__status webcam-proctor__status--error">Models failed to load</span>
        )}
        {!loadingModels && modelsReady && cameraOn && (
          <span className="webcam-proctor__status webcam-proctor__status--ok">Camera ON</span>
        )}
      </div>

      <video ref={videoRef} className="webcam-proctor__video" playsInline muted></video>

      <canvas ref={canvasRef} className="webcam-proctor__canvas" />

      <div className="webcam-proctor__controls">
        <button onClick={startCamera} disabled={cameraOn || !modelsReady} className="webcam-proctor__btn webcam-proctor__btn--start">Start</button>
        <button onClick={stopCamera} disabled={!cameraOn} className="webcam-proctor__btn webcam-proctor__btn--stop">Stop</button>
      </div>
    </div>
  );
};

export default WebcamProctor;
