import { useEffect, useRef, useState } from "react";
import { Loader2, CameraOff } from "lucide-react";
import { BrowserMultiFormatReader } from "@zxing/browser";

interface CameraScannerProps {
  onResult: (text: string) => void;
  label?: string;
}

export function CameraScanner({
  onResult,
  label = "Richt de camera op een barcode of QR-code",
}: CameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopRef = useRef(false);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  const [status, setStatus] = useState<"loading" | "scanning" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    stopRef.current = false;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });

        if (stopRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();
        setStatus("scanning");

        // ── Native BarcodeDetector (Chrome Android / desktop) ───────────
        if ("BarcodeDetector" in window) {
          const detector = new (window as any).BarcodeDetector({
            formats: [
              "ean_13","ean_8","upc_a","upc_e",
              "code_128","code_39","code_93",
              "qr_code","data_matrix","itf",
            ],
          });

          const loop = async () => {
            if (stopRef.current) return;
            try {
              if (video.readyState >= video.HAVE_CURRENT_DATA) {
                const codes = await detector.detect(video);
                if (codes.length > 0) {
                  stopRef.current = true;
                  onResultRef.current(codes[0].rawValue);
                  return;
                }
              }
            } catch {/* NotFoundException is normal, ignore */}
            if (!stopRef.current) requestAnimationFrame(loop);
          };
          requestAnimationFrame(loop);

        // ── @zxing fallback ─────────────────────────────────────────────
        } else {
          const reader = new BrowserMultiFormatReader();
          const controlsRef = { current: null as any };

          reader
            .decodeFromVideoDevice(undefined, video, (result, _err, controls) => {
              if (controls && !controlsRef.current) controlsRef.current = controls;
              if (result && !stopRef.current) {
                stopRef.current = true;
                controlsRef.current?.stop();
                stream.getTracks().forEach((t) => t.stop());
                onResultRef.current(result.getText());
              }
            })
            .then((controls) => {
              controlsRef.current = controls;
            })
            .catch((err: Error) => {
              console.error("@zxing error:", err);
            });
        }
      } catch (err: any) {
        const name = (err as Error).name ?? "";
        const msg =
          name === "NotAllowedError" || name === "PermissionDeniedError"
            ? "Sta cameratoegang toe in je browser en probeer opnieuw."
            : name === "NotFoundError"
            ? "Geen camera gevonden op dit apparaat."
            : "Camera kon niet worden gestart.";
        setErrorMsg(msg);
        setStatus("error");
      }
    }

    start();

    return () => {
      stopRef.current = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <div
        className="relative w-full max-w-sm rounded-2xl overflow-hidden bg-black"
        style={{ aspectRatio: "1 / 1" }}
        data-tour="add-active-content"
      >
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          muted
          playsInline
        />

        {status === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
        )}

        {status === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-3 p-6 text-center">
            <CameraOff className="w-10 h-10 text-white/70" />
            <p className="text-white text-sm">{errorMsg}</p>
          </div>
        )}

        {status === "scanning" && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-52 h-52 relative">
              {/* Corner brackets */}
              <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-white rounded-tl-md" />
              <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-white rounded-tr-md" />
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-white rounded-bl-md" />
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-white rounded-br-md" />
              {/* Scan line */}
              <div className="absolute left-2 right-2 h-0.5 bg-primary/90 rounded animate-[scanline_2s_ease-in-out_infinite]"
                   style={{ top: "50%", transform: "translateY(-50%)" }} />
            </div>
          </div>
        )}
      </div>

      <p className="text-sm text-muted-foreground text-center max-w-[260px]">{label}</p>
    </div>
  );
}
