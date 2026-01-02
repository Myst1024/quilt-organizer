import { useState, useCallback, useRef, useEffect } from "react";
import "./index.css";

const TILE_SIZE = 20; // 1 inch = 20px

interface QuiltSquare {
  id: string;
  imageData?: string; // base64 encoded image data
  width: number; // in inches
  height: number; // in inches
  color: string; // fallback color for squares without images
  x: number; // position in inches from left edge of quilt
  y: number; // position in inches from top edge of quilt
  isInQuilt: boolean; // false = in extra space below
}

interface Quilt {
  width: number; // in inches
  height: number; // in inches
}

export function App() {
  const [quilt, setQuilt] = useState<Quilt>({ width: 60, height: 48 }); // Default 5x4 feet
  const [squares, setSquares] = useState<QuiltSquare[]>([]);

  const addSquare = useCallback((imageData: string | null, width: number, height: number) => {
    const colors: string[] = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)]!;

    const newSquare: QuiltSquare = {
      id: Date.now().toString(),
      imageData: imageData || undefined,
      width,
      height,
      color: randomColor,
      x: 0,
      y: quilt.height + 2, // Place in extra space below quilt
      isInQuilt: false
    };

    setSquares(prev => [...prev, newSquare]);
  }, [quilt.height]);

  const updateSquarePosition = useCallback((id: string, x: number, y: number, isInQuilt: boolean) => {
    setSquares(prev => prev.map(square =>
      square.id === id
        ? { ...square, x, y, isInQuilt }
        : square
    ));
  }, []);

  const removeSquare = useCallback((id: string) => {
    setSquares(prev => prev.filter(square => square.id !== id));
  }, []);

  return (
    <div className="app">
      <h1>T-Shirt Quilt Designer</h1>

      <div className="controls">
        <div className="quilt-settings">
          <h2>Quilt Dimensions</h2>
          <div className="dimension-inputs">
              <label>
                Width (inches):
                <input
                  type="number"
                  min="1"
                  step="0.5"
                  value={quilt.width}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    if (!isNaN(value) && value > 0) {
                      setQuilt(prev => ({ ...prev, width: value }));
                    }
                  }}
                />
              </label>
              <label>
                Height (inches):
                <input
                  type="number"
                  min="1"
                  step="0.5"
                  value={quilt.height}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    if (!isNaN(value) && value > 0) {
                      setQuilt(prev => ({ ...prev, height: value }));
                    }
                  }}
                />
              </label>
          </div>
        </div>

        <div className="square-creator">
          <h2>Add New Square</h2>
          <SquareCreator onAddSquare={addSquare} />
        </div>
      </div>

      <QuiltCanvas
        quilt={quilt}
        squares={squares}
        tileSize={TILE_SIZE}
        onSquareUpdate={updateSquarePosition}
        onSquareRemove={removeSquare}
      />
    </div>
  );
}

function SquareCreator({ onAddSquare }: { onAddSquare: (imageData: string | null, width: number, height: number) => void }) {
  console.log('SquareCreator render');
  const [width, setWidth] = useState(12);
  const [height, setHeight] = useState(12);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoReadyRef = useRef(false);

  // Debug effect to monitor video state
  useEffect(() => {
    if (isCameraActive && videoRef.current) {
      const video = videoRef.current;
      const logVideoState = () => {
        console.log('Video state update:', {
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
          readyState: video.readyState,
          networkState: video.networkState,
          isVideoReady: isVideoReady
        });
      };

      video.addEventListener('loadedmetadata', logVideoState);
      video.addEventListener('loadeddata', logVideoState);
      video.addEventListener('canplay', logVideoState);
      video.addEventListener('play', logVideoState);

      return () => {
        video.removeEventListener('loadedmetadata', logVideoState);
        video.removeEventListener('loadeddata', logVideoState);
        video.removeEventListener('canplay', logVideoState);
        video.removeEventListener('play', logVideoState);
      };
    }
  }, [isCameraActive, isVideoReady]);

  const startCamera = async () => {
    console.log('startCamera called');
    console.log('navigator.mediaDevices:', navigator.mediaDevices);
    console.log('getUserMedia available:', !!navigator.mediaDevices?.getUserMedia);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.error('getUserMedia not supported');
      alert('Camera not supported in this browser');
      return;
    }

    if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
      console.error('Camera access requires HTTPS');
      alert('Camera access requires a secure connection (HTTPS). Please use HTTPS or localhost.');
      return;
    }

    try {
      console.log('Requesting camera access...');
      let mediaStream;
      try {
        // Try back camera first
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });
        console.log('Back camera granted');
      } catch (backCameraError) {
        console.log('Back camera failed, trying front camera:', backCameraError);
        // Fallback to front camera
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' }
        });
        console.log('Front camera granted');
      }
      console.log('Camera access granted, stream received:', mediaStream);
      setStream(mediaStream);
      setIsCameraActive(true);
      setIsVideoReady(false);
      videoReadyRef.current = false;

      // Wait for the component to re-render with the video element
      setTimeout(() => {
        if (videoRef.current) {
          console.log('Video element found after render, setting srcObject');
          const video = videoRef.current;
          video.srcObject = mediaStream;

          // Wait for video to be ready - multiple event listeners for robustness
          const checkVideoReady = () => {
            console.log('checkVideoReady called:', {
              videoWidth: video.videoWidth,
              videoHeight: video.videoHeight,
              readyState: video.readyState,
              networkState: video.networkState
            });
            if (video.videoWidth > 0 && video.videoHeight > 0 && video.readyState >= 2) {
              console.log('Video ready! Dimensions:', video.videoWidth, 'x', video.videoHeight);
              setIsVideoReady(true);
              videoReadyRef.current = true;
              // Remove all event listeners
              video.removeEventListener('loadeddata', checkVideoReady);
              video.removeEventListener('canplay', checkVideoReady);
              video.removeEventListener('play', checkVideoReady);
            }
          };

          console.log('Adding event listeners');
          video.addEventListener('loadeddata', checkVideoReady);
          video.addEventListener('canplay', checkVideoReady);
          video.addEventListener('play', checkVideoReady);

          // Immediate check in case video is already ready
          setTimeout(() => {
            console.log('Immediate check - video state:', {
              videoWidth: video.videoWidth,
              videoHeight: video.videoHeight,
              readyState: video.readyState,
              networkState: video.networkState
            });
            checkVideoReady();
          }, 10);

          // Fallback timeout - check actual video dimensions
          setTimeout(() => {
            console.log('Fallback check - video state:', {
              videoWidth: video.videoWidth,
              videoHeight: video.videoHeight,
              readyState: video.readyState,
              isVideoReady: videoReadyRef.current
            });
            if (!videoReadyRef.current && video.videoWidth > 0 && video.videoHeight > 0) {
              console.log('Fallback: Video ready via timeout check');
              setIsVideoReady(true);
              videoReadyRef.current = true;
              video.removeEventListener('loadeddata', checkVideoReady);
              video.removeEventListener('canplay', checkVideoReady);
              video.removeEventListener('play', checkVideoReady);
            } else if (!videoReadyRef.current) {
              console.warn('Video still not ready after timeout');
            }
          }, 3000);
        } else {
          console.error('videoRef.current is still null after render delay!');
          alert('Video element not found after render. Please refresh the page.');
        }
      }, 100); // Small delay to allow component re-render
    } catch (error) {
      console.error('Error accessing camera:', error);
      alert('Unable to access camera. Please check permissions.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsCameraActive(false);
    setIsVideoReady(false);
    videoReadyRef.current = false;
    setCapturedImage(null);
  };

  const takePhoto = () => {
    if (!isVideoReady) {
      alert('Camera is still loading. Please wait.');
      return;
    }

    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (context && video.videoWidth > 0 && video.videoHeight > 0 && video.readyState >= 2) {
        try {
          // Set canvas size to match video
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;

          // Draw the current video frame
          context.drawImage(video, 0, 0);

          // Crop to match square dimensions aspect ratio
          // For portrait squares (height > width), prioritize keeping full height
          // For landscape squares (width > height), prioritize keeping full width
          const targetAspectRatio = width / height; // width:height ratio of the square
          const imageAspectRatio = canvas.width / canvas.height;

          console.log('Cropping:', {
            squareDimensions: `${width}" × ${height}"`,
            targetAspectRatio: targetAspectRatio.toFixed(2),
            imageDimensions: `${canvas.width} × ${canvas.height}`,
            imageAspectRatio: imageAspectRatio.toFixed(2)
          });

          let cropWidth, cropHeight, startX, startY;

          if (height >= width) {
            // Portrait square (5x10) - prioritize keeping full height, crop width
            cropHeight = canvas.height;
            cropWidth = canvas.height * targetAspectRatio;
            startX = (canvas.width - cropWidth) / 2;
            startY = 0;
            console.log('Portrait square - keeping full height, cropping width:', {
              cropWidth: cropWidth.toFixed(0),
              cropHeight: cropHeight.toFixed(0),
              startX: startX.toFixed(0)
            });
          } else {
            // Landscape square (10x5) - prioritize keeping full width, crop height
            cropWidth = canvas.width;
            cropHeight = canvas.width / targetAspectRatio;
            startX = 0;
            startY = (canvas.height - cropHeight) / 2;
            console.log('Landscape square - keeping full width, cropping height:', {
              cropWidth: cropWidth.toFixed(0),
              cropHeight: cropHeight.toFixed(0),
              startY: startY.toFixed(0)
            });
          }

          // Create cropped image data
          const croppedCanvas = document.createElement('canvas');
          const croppedContext = croppedCanvas.getContext('2d');
          croppedCanvas.width = cropWidth;
          croppedCanvas.height = cropHeight;

          if (croppedContext) {
            croppedContext.drawImage(
              canvas,
              startX, startY, cropWidth, cropHeight,
              0, 0, cropWidth, cropHeight
            );

            const imageData = croppedCanvas.toDataURL('image/jpeg', 0.9);
            setCapturedImage(imageData);
          }
        } catch (error) {
          console.error('Error capturing photo:', error);
          alert('Failed to capture photo. Please try again.');
        }
      } else {
        console.warn('Video not ready for capture. Width:', video.videoWidth, 'Height:', video.videoHeight, 'ReadyState:', video.readyState);
        alert('Camera not ready. Please wait a moment and try again.');
      }
    } else {
      alert('Camera not available. Please try starting the camera again.');
    }
  };

  const addSquare = () => {
    onAddSquare(capturedImage, width, height);
    setCapturedImage(null);
    stopCamera();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addSquare();
  };

  return (
    <div className="square-form">
      <div className="camera-section">
        {!isCameraActive && !capturedImage && (
          <button type="button" onClick={() => {
            console.log('Take Photo button clicked');
            startCamera();
          }} className="camera-button">
            📸 Take Photo
          </button>
        )}

        {isCameraActive && !capturedImage && (
          <div className="camera-preview">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="camera-video"
            />
            {!isVideoReady && (
              <div className="camera-loading">
                <p>Setting up camera...</p>
                <p className="camera-tip">If this takes too long, try refreshing the page</p>
              </div>
            )}
            <div className="camera-controls">
              <button
                type="button"
                onClick={takePhoto}
                disabled={!isVideoReady}
              >
                📷 {isVideoReady ? 'Capture' : 'Loading...'}
              </button>
              {!isVideoReady && (
                <button type="button" onClick={() => {
                  // Force ready state if video has dimensions
                  if (videoRef.current && videoRef.current.videoWidth > 0) {
                    setIsVideoReady(true);
                    videoReadyRef.current = true;
                  }
                }}>
                  🔄 Try Now
                </button>
              )}
              <button type="button" onClick={stopCamera}>❌ Cancel</button>
            </div>
          </div>
        )}

        {capturedImage && (
          <div className="image-preview">
            <img
              src={capturedImage}
              alt="Captured"
              className="captured-image"
              style={{
                width: Math.min(200, width * 20),
                height: Math.min(200, height * 20),
                objectFit: 'cover'
              }}
            />
            <div className="image-controls">
              <button type="button" onClick={addSquare}>✅ Add Square</button>
              <button type="button" onClick={() => setCapturedImage(null)}>🔄 Retake</button>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="dimensions-form">
        <label>
          Width (inches):
          <input
            type="number"
            min="1"
            step="0.5"
            value={width}
            onChange={(e) => {
              const value = parseFloat(e.target.value);
              if (!isNaN(value) && value > 0) {
                setWidth(value);
              }
            }}
          />
        </label>
        <label>
          Height (inches):
          <input
            type="number"
            min="1"
            step="0.5"
            value={height}
            onChange={(e) => {
              const value = parseFloat(e.target.value);
              if (!isNaN(value) && value > 0) {
                setHeight(value);
              }
            }}
          />
        </label>
      </form>

      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}

function QuiltCanvas({
  quilt,
  squares,
  tileSize,
  onSquareUpdate,
  onSquareRemove
}: {
  quilt: Quilt;
  squares: QuiltSquare[];
  tileSize: number;
  onSquareUpdate: (id: string, x: number, y: number, isInQuilt: boolean) => void;
  onSquareRemove: (id: string) => void;
}) {
  const [draggedSquare, setDraggedSquare] = useState<QuiltSquare | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

  const quiltSquares = squares.filter(square => square.isInQuilt);
  const extraSquares = squares.filter(square => !square.isInQuilt);

  // Handle document-level mouse events during dragging
  useEffect(() => {
    if (!draggedSquare) return;

    const handleDocumentMouseMove = (e: MouseEvent) => {
      if (!canvasRef.current) return;

      const canvasRect = canvasRef.current.getBoundingClientRect();
      const x = (e.clientX - canvasRect.left - dragOffset.x) / tileSize;
      const y = (e.clientY - canvasRect.top - dragOffset.y) / tileSize;

      // Snap to nearest half-tile (0.5 inch grid)
      const snappedX = Math.round(x * 2) / 2;
      const snappedY = Math.round(y * 2) / 2;

      // Only clamp X position to quilt bounds, allow Y to go below quilt for dragging to available area
      const clampedX = Math.max(0, Math.min(snappedX, quilt.width - draggedSquare.width));
      const clampedY = snappedY; // Don't clamp Y position - allow dragging below quilt

      setDraggedSquare(prev => prev ? { ...prev, x: clampedX, y: clampedY } : null);
    };

    const handleDocumentMouseUp = () => {
      if (!draggedSquare) return;

      const finalSquare = draggedSquare;

      // Check if square is being placed in quilt area
      const isInQuilt = finalSquare.y >= 0 && finalSquare.y < quilt.height &&
                        finalSquare.x >= 0 && finalSquare.x < quilt.width;

      if (isInQuilt) {
        // Find nearest available position without overlapping
        const snappedPosition = findNearestAvailablePosition(finalSquare, quiltSquares, quilt);
        onSquareUpdate(finalSquare.id, snappedPosition.x, snappedPosition.y, true);
      } else {
        // Return to extra space - maintain relative X position but place below quilt
        const extraSpaceX = Math.max(0, Math.min(finalSquare.x, quilt.width - finalSquare.width));
        onSquareUpdate(finalSquare.id, extraSpaceX, quilt.height + 2, false);
      }

      setDraggedSquare(null);
    };

    document.addEventListener('mousemove', handleDocumentMouseMove);
    document.addEventListener('mouseup', handleDocumentMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleDocumentMouseMove);
      document.removeEventListener('mouseup', handleDocumentMouseUp);
    };
  }, [draggedSquare, dragOffset, tileSize, quilt.width, quilt.height, quiltSquares, onSquareUpdate]);

  const handleMouseDown = useCallback((e: React.MouseEvent, square: QuiltSquare) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setDraggedSquare(square);
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  }, []);

  // Simplified handlers - document-level events handle the actual dragging
  const handleMouseMove = useCallback(() => {
    // Document-level mousemove handles the actual dragging
  }, []);

  const handleMouseUp = useCallback(() => {
    // Document-level mouseup handles the drop logic
  }, []);

  return (
    <div className="quilt-canvas" ref={canvasRef}>
      <div
        className="quilt-area"
        style={{
          width: quilt.width * tileSize,
          height: quilt.height * tileSize,
          border: '2px solid #333',
          position: 'relative',
          marginBottom: '40px',
          backgroundColor: '#f9f9f9'
        }}
      >
        {/* Render grid lines */}
        {Array.from({ length: Math.ceil(quilt.width) + 1 }, (_, i) => (
          <div
            key={`v-${i}`}
            style={{
              position: 'absolute',
              left: i * tileSize,
              top: 0,
              width: '1px',
              height: '100%',
              backgroundColor: '#ddd'
            }}
          />
        ))}
        {Array.from({ length: Math.ceil(quilt.height) + 1 }, (_, i) => (
          <div
            key={`h-${i}`}
            style={{
              position: 'absolute',
              top: i * tileSize,
              left: 0,
              height: '1px',
              width: '100%',
              backgroundColor: '#ddd'
            }}
          />
        ))}

        {/* Render quilt squares */}
        {quiltSquares.map(square => (
          <div
            key={square.id}
            className={`square ${draggedSquare?.id === square.id ? 'dragging' : ''}`}
            style={{
              position: 'absolute',
              left: square.x * tileSize,
              top: square.y * tileSize,
              width: square.width * tileSize,
              height: square.height * tileSize,
              backgroundColor: square.imageData ? 'transparent' : square.color,
              backgroundImage: square.imageData ? `url(${square.imageData})` : 'none',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              border: '1px solid #333',
              cursor: 'grab',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              color: square.imageData ? 'transparent' : '#333',
              userSelect: 'none'
            }}
            onMouseDown={(e) => handleMouseDown(e, square)}
          >
            {!square.imageData && `${square.width}" × ${square.height}"`}
          </div>
        ))}

        {/* Render dragged square when within or above quilt area */}
        {draggedSquare && draggedSquare.y < quilt.height && (
          <div
            className="square dragging"
            style={{
              position: 'absolute',
              left: draggedSquare.x * tileSize,
              top: draggedSquare.y * tileSize,
              width: draggedSquare.width * tileSize,
              height: draggedSquare.height * tileSize,
              backgroundColor: draggedSquare.imageData ? 'transparent' : draggedSquare.color,
              backgroundImage: draggedSquare.imageData ? `url(${draggedSquare.imageData})` : 'none',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              border: '2px dashed #333',
              opacity: 0.7,
              pointerEvents: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              color: draggedSquare.imageData ? 'transparent' : '#333'
            }}
          >
            {!draggedSquare.imageData && `${draggedSquare.width}" × ${draggedSquare.height}"`}
          </div>
        )}
      </div>

      <div className="extra-space">
        <h3>Available Squares (drag to quilt above)</h3>
        <div
          className="squares-container"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '10px',
            minHeight: '100px',
            padding: '10px',
            border: '1px dashed #ccc'
          }}
        >
          {extraSquares.map(square => (
            <div
              key={square.id}
              className={`square ${draggedSquare?.id === square.id ? 'dragging' : ''}`}
              style={{
                width: square.width * tileSize,
                height: square.height * tileSize,
                backgroundColor: square.imageData ? 'transparent' : square.color,
                backgroundImage: square.imageData ? `url(${square.imageData})` : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                border: '1px solid #333',
                cursor: 'grab',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                color: square.imageData ? 'transparent' : '#333',
                userSelect: 'none'
              }}
              onMouseDown={(e) => handleMouseDown(e, square)}
            >
              {!square.imageData && `${square.width}" × ${square.height}"`}
            </div>
          ))}

          {/* Render dragged square when in available area */}
          {draggedSquare && draggedSquare.y >= quilt.height && (
            <div
              className="square dragging"
              style={{
                position: 'absolute',
                left: draggedSquare.x * tileSize,
                top: (draggedSquare.y - quilt.height - 2) * tileSize, // Adjust for the 2-inch gap
                width: draggedSquare.width * tileSize,
                height: draggedSquare.height * tileSize,
                backgroundColor: draggedSquare.imageData ? 'transparent' : draggedSquare.color,
                backgroundImage: draggedSquare.imageData ? `url(${draggedSquare.imageData})` : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                border: '2px dashed #333',
                opacity: 0.7,
                pointerEvents: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                color: draggedSquare.imageData ? 'transparent' : '#333'
              }}
            >
              {!draggedSquare.imageData && `${draggedSquare.width}" × ${draggedSquare.height}"`}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Collision detection and snapping logic
function findNearestAvailablePosition(
  draggedSquare: QuiltSquare,
  existingSquares: QuiltSquare[],
  quilt: Quilt
): { x: number; y: number } {
  const { width: quiltWidth, height: quiltHeight } = quilt;
  const { width: squareWidth, height: squareHeight } = draggedSquare;

  // Snap the dragged position to nearest half-tile and clamp to bounds
  let bestX = Math.max(0, Math.min(Math.round(draggedSquare.x * 2) / 2, quiltWidth - squareWidth));
  let bestY = Math.max(0, Math.min(Math.round(draggedSquare.y * 2) / 2, quiltHeight - squareHeight));

  // Check if current position overlaps with any existing square
  const hasOverlap = existingSquares.some(square => {
    if (square.id === draggedSquare.id) return false;
    return !(
      bestX + squareWidth <= square.x ||
      square.x + square.width <= bestX ||
      bestY + squareHeight <= square.y ||
      square.y + square.height <= bestY
    );
  });

  if (!hasOverlap) {
    return { x: bestX, y: bestY };
  }

  // If there's overlap, try to find the nearest available position
  // Search through half-tile grid positions only
  const step = 0.5; // half-inch steps
  let minDistance = Infinity;
  let nearestPos = { x: bestX, y: bestY };

  for (let y = 0; y <= quiltHeight - squareHeight; y += step) {
    // Ensure y is snapped to half-tile
    const snappedY = Math.round(y * 2) / 2;
    for (let x = 0; x <= quiltWidth - squareWidth; x += step) {
      // Ensure x is snapped to half-tile
      const snappedX = Math.round(x * 2) / 2;
      const overlaps = existingSquares.some(square => {
        if (square.id === draggedSquare.id) return false;
        return !(
          snappedX + squareWidth <= square.x ||
          square.x + square.width <= snappedX ||
          snappedY + squareHeight <= square.y ||
          square.y + square.height <= snappedY
        );
      });

      if (!overlaps) {
        const distance = Math.sqrt(
          Math.pow(snappedX - draggedSquare.x, 2) + Math.pow(snappedY - draggedSquare.y, 2)
        );
        if (distance < minDistance) {
          minDistance = distance;
          nearestPos = { x: snappedX, y: snappedY };
        }
      }
    }
  }

  return nearestPos;
}

export default App;
