import React, { useEffect, useRef, useState } from 'react';
import * as faceapi from 'face-api.js';
import { Camera } from "lucide-react";
import { useSnackbar } from "notistack";

export default function FaceRecognition({ mode = 'register', open, setOpen, setFaceIdData }) {
  const videoRef = useRef();
  const streamRef = useRef(null);
  const [status, setStatus] = useState('Loading models...');
  const [countdown, setCountdown] = useState(null); // countdown state
  const { enqueueSnackbar } = useSnackbar();

  const detectionOptions = new faceapi.TinyFaceDetectorOptions({
    inputSize: 512,
    scoreThreshold: 0.4,
  });

  useEffect(() => {
    if (!open) {
      stopCamera();
      return;
    }

    const loadModels = async () => {
      const MODEL_URL = "/models";
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
      setStatus("Models loaded. Starting camera...");
      startVideo();
    };

    loadModels();

    return () => {
      stopCamera();
    };
  }, [open]);

  const startVideo = () => {
    navigator.mediaDevices.getUserMedia({ video: true })
      .then(stream => {
        streamRef.current = stream;
        if (!videoRef.current) return;
        videoRef.current.srcObject = stream;

        videoRef.current.onloadedmetadata = async () => {
          try {
            await videoRef.current.play();
            const waitForData = setInterval(() => {
              if (videoRef.current && videoRef.current.readyState >= 2) {
                clearInterval(waitForData);
                setStatus("Camera started.");
                startCountdown(); // 🔹 trigger countdown before detection
              }
            }, 100);
          } catch (err) {
            enqueueSnackbar("Unable to start video playback", { variant: 'error' });
          }
        };
      })
      .catch(err => {
        console.error("Camera error:", err);
        enqueueSnackbar("Unable to access camera", { variant: 'error' });
      });
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCountdown(null);
  };

  // 🔹 Countdown before detection starts
  const startCountdown = () => {
    let counter = 3;
    setCountdown(counter);
    const timer = setInterval(() => {
      counter -= 1;
      if (counter === 0) {
        clearInterval(timer);
        setCountdown(null);
        setStatus("Looking for your face...");
        startAutoDetection(); // start detection after countdown
      } else {
        setCountdown(counter);
      }
    }, 1000);
  };

  const startAutoDetection = () => {
    let hasCaptured = false;
    const detectionInterval = setInterval(async () => {
      if (hasCaptured || !videoRef.current) return;

      if (!(videoRef.current instanceof HTMLVideoElement) || videoRef.current.readyState < 2) {
        return;
      }

      const detection = await faceapi
        .detectSingleFace(videoRef.current, detectionOptions)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (detection) {
        hasCaptured = true;
        clearInterval(detectionInterval);
        captureFace(detection.descriptor);
      }
    }, 500);

    const cleanup = () => clearInterval(detectionInterval);
    window.addEventListener("beforeunload", cleanup);
    return cleanup;
  };

  const captureFace = async (descriptorFromLoop) => {
    const detections = await faceapi
      .detectAllFaces(videoRef.current, detectionOptions)
      .withFaceLandmarks()
      .withFaceDescriptors();

    if (!detections || detections.length === 0) {
      enqueueSnackbar('No face detected. Try again.', { variant: 'warning' });
      return;
    }

    if (detections.length > 1) {
      enqueueSnackbar('Multiple faces detected. Please ensure only one face is visible.', { variant: 'warning' });
      return;
    }

    const descriptorArray = Array.from(detections[0].descriptor);


    if (descriptorArray) {
      setFaceIdData(descriptorArray);
      setOpen(false);
      if (mode === "register") {
        enqueueSnackbar('Face detected', { variant: 'success' });
      }
      return;
    }
  };

  if (!open) return null;

  return (
    <div className='absolute top-0 left-0 right-0 bottom-0 flex items-center justify-center z-9999 bg-black/30'>
      <div className='flex flex-col gap-10 items-center justify-center'>
        <p className='text-xl bg-white px-4 py-2 rounded-sm'>
          {countdown !== null ? `Capturing in ${countdown}...` : status}
        </p>
        <video ref={videoRef} autoPlay muted width="480" height="360" />
        <div className='flex gap-4'>
          <button
            onClick={() => setOpen(false)}
            className="bg-white px-4 py-2 rounded-xl hover:bg-gray-200 transition"
          >
            Close
          </button>
          <button
            onClick={() => captureFace()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition"
          >
            <Camera size={20} />
            {mode === "register" ? "Register Face" : "Match Face"}
          </button>
        </div>
      </div>
    </div>
  );
}
