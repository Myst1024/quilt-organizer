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
  buffer: number; // buffer area in inches around the quilt
}

export function App() {
  const [quilt, setQuilt] = useState<Quilt>({ width: 60, height: 48, buffer: 5 }); // Default 5x4 feet with 5 inch buffer
  const [squares, setSquares] = useState<QuiltSquare[]>([]);

  const addSquare = useCallback((imageData: string | null, width: number, height: number) => {
    const colors: string[] = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)]!;

    const totalHeight = quilt.height + 2 * quilt.buffer;

    const newSquare: QuiltSquare = {
      id: Date.now().toString(),
      imageData: imageData || undefined,
      width,
      height,
      color: randomColor,
      x: 0,
      y: totalHeight + 2, // Place in extra space below buffer area
      isInQuilt: false
    };

    setSquares(prev => [...prev, newSquare]);
  }, [quilt.height, quilt.buffer]);

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

  const updateSquareDimensions = useCallback((id: string, width: number, height: number) => {
    setSquares(prev => prev.map(square =>
      square.id === id
        ? { ...square, width, height }
        : square
    ));
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
              <label>
                Buffer (inches):
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={quilt.buffer}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    if (!isNaN(value) && value >= 0) {
                      setQuilt(prev => ({ ...prev, buffer: value }));
                    }
                  }}
                />
              </label>
          </div>
        </div>
      </div>

      <QuiltCanvas
        quilt={quilt}
        squares={squares}
        tileSize={TILE_SIZE}
        onSquareUpdate={updateSquarePosition}
        onSquareRemove={removeSquare}
        onSquareDimensionUpdate={updateSquareDimensions}
        squareCreator={<SquareCreator onAddSquare={addSquare} />}
        buffer={quilt.buffer}
      />
    </div>
  );
}

function SquareCreator({ onAddSquare }: { onAddSquare: (imageData: string | null, width: number, height: number) => void }) {
  console.log('SquareCreator render');
  const [width, setWidth] = useState(12);
  const [height, setHeight] = useState(12);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Ensure video srcObject is maintained across re-renders
  useEffect(() => {
    if (isCameraActive && videoRef.current && stream && !videoRef.current.srcObject) {
      console.log('Reattaching video srcObject after render');
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(console.error);
    }
  }, [isCameraActive, stream]);

  // Ensure video is properly set up when switching back to camera view (retake)
  useEffect(() => {
    if (isCameraActive && !capturedImage && videoRef.current && stream) {
      console.log('Setting up video for camera view');
      // Reset streaming state
      setStreaming(false);
      // Ensure stream is attached
      if (!videoRef.current.srcObject) {
        videoRef.current.srcObject = stream;
      }
      videoRef.current.play().catch(console.error);
    }
  }, [isCameraActive, capturedImage, stream]);

  // Set up video dimensions when the stream starts playing
  useEffect(() => {
    if (isCameraActive && videoRef.current) {
      const video = videoRef.current;

      const handleLoadedMetadata = () => {
        console.log('Video loaded metadata, dimensions:', video.videoWidth, 'x', video.videoHeight);
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          // Set video element dimensions to match the stream for proper display
          const maxWidth = 300;
          const aspectRatio = video.videoHeight / video.videoWidth;
          const width = Math.min(video.videoWidth, maxWidth);
          const height = width * aspectRatio;

          video.width = width;
          video.height = height;
          setStreaming(true);
        }
      };

      const handleCanPlay = () => {
        console.log('Video canplay, dimensions:', video.videoWidth, 'x', video.videoHeight, 'readyState:', video.readyState);
        // canplay might fire before dimensions are available, so also check here
        if (!streaming && video.videoWidth > 0 && video.videoHeight > 0) {
          const maxWidth = 300;
          const aspectRatio = video.videoHeight / video.videoWidth;
          const width = Math.min(video.videoWidth, maxWidth);
          const height = width * aspectRatio;

          video.width = width;
          video.height = height;
          setStreaming(true);
        }
      };

      const handlePlaying = () => {
        console.log('Video playing, dimensions:', video.videoWidth, 'x', video.videoHeight);
        // When video actually starts playing, ensure streaming is set
        if (!streaming && video.videoWidth > 0 && video.videoHeight > 0) {
          const maxWidth = 300;
          const aspectRatio = video.videoHeight / video.videoWidth;
          const width = Math.min(video.videoWidth, maxWidth);
          const height = width * aspectRatio;

          video.width = width;
          video.height = height;
          setStreaming(true);
        }
      };

      video.addEventListener('loadedmetadata', handleLoadedMetadata);
      video.addEventListener('canplay', handleCanPlay);
      video.addEventListener('playing', handlePlaying);

      return () => {
        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
        video.removeEventListener('canplay', handleCanPlay);
        video.removeEventListener('playing', handlePlaying);
      };
    }
  }, [isCameraActive, streaming]);

  const startCamera = async () => {
    console.log('startCamera called');

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

      // Wait for the component to re-render with the video element
      setTimeout(() => {
        if (videoRef.current) {
          console.log('Setting video srcObject, stream active:', mediaStream.active);
          videoRef.current.srcObject = mediaStream;
          console.log('Video srcObject set, calling play');
          videoRef.current.play().then(() => {
            console.log('Video play promise resolved');
          }).catch(err => {
            console.error('Error playing video:', err);
            alert('Error starting camera: ' + err.message);
          });
        }
      }, 100);
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
    setStreaming(false);
    setCapturedImage(null);
  };

  const takePhoto = () => {
    if (!videoRef.current || !canvasRef.current) {
      alert('Camera not available. Please try starting the camera again.');
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) {
      alert('Failed to capture photo. Please try again.');
      return;
    }

    // Check if video has lost its source
    if (!video.srcObject && stream) {
      console.log('Video lost srcObject, reattaching stream');
      video.srcObject = stream;
      video.play().catch(console.error);
      alert('Camera connection lost. Please wait a moment for it to reconnect.');
      return;
    }

    if (video.videoWidth === 0 || video.videoHeight === 0 || video.readyState < 2) {
      console.warn('Video not ready for capture:', {
        streaming,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        readyState: video.readyState,
        srcObject: !!video.srcObject,
        streamActive: video.srcObject ? (video.srcObject as MediaStream).active : false
      });
      alert('Camera is still loading. Please wait a moment.');
      return;
    }

    try {
      // Set canvas size to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Draw the current video frame
      context.drawImage(video, 0, 0);

      // Crop to match square dimensions aspect ratio
      const targetAspectRatio = width / height;
      const imageAspectRatio = canvas.width / canvas.height;

      let cropWidth, cropHeight, startX, startY;

      if (height >= width) {
        // Portrait square - prioritize keeping full height, crop width
        cropHeight = canvas.height;
        cropWidth = canvas.height * targetAspectRatio;
        startX = (canvas.width - cropWidth) / 2;
        startY = 0;
      } else {
        // Landscape square - prioritize keeping full width, crop height
        cropWidth = canvas.width;
        cropHeight = canvas.width / targetAspectRatio;
        startX = 0;
        startY = (canvas.height - cropHeight) / 2;
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
        // Keep camera active - don't stop the stream
      }
    } catch (error) {
      console.error('Error capturing photo:', error);
      alert('Failed to capture photo. Please try again.');
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
            <div className="camera-controls">
              <button
                type="button"
                onClick={takePhoto}
              >
                📷 Capture
              </button>
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
              <button type="button" onClick={() => {
                console.log('Retake clicked');
                setCapturedImage(null);
                // Video setup will be handled by useEffect after render
              }}>🔄 Retake</button>
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
  onSquareRemove,
  onSquareDimensionUpdate,
  squareCreator,
  buffer
}: {
  quilt: Quilt;
  squares: QuiltSquare[];
  tileSize: number;
  onSquareUpdate: (id: string, x: number, y: number, isInQuilt: boolean) => void;
  onSquareRemove: (id: string) => void;
  onSquareDimensionUpdate: (id: string, width: number, height: number) => void;
  squareCreator: React.ReactNode;
  buffer: number;
}) {
  const [draggedSquare, setDraggedSquare] = useState<QuiltSquare | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [editingSquare, setEditingSquare] = useState<QuiltSquare | null>(null);
  const [editWidth, setEditWidth] = useState(12);
  const [editHeight, setEditHeight] = useState(12);
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

      // Clamp X position to canvas bounds, but allow Y to go below canvas for returning to available area
      const clampedX = Math.max(0, Math.min(snappedX, totalWidth - draggedSquare.width));
      const clampedY = snappedY; // Don't clamp Y - allow dragging below canvas

      setDraggedSquare(prev => prev ? { ...prev, x: clampedX, y: clampedY } : null);
    };

    const handleDocumentTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!canvasRef.current) return;

      const canvasRect = canvasRef.current.getBoundingClientRect();
      const touch = e.touches[0];
      if (!touch) return;
      const x = (touch.clientX - canvasRect.left - dragOffset.x) / tileSize;
      const y = (touch.clientY - canvasRect.top - dragOffset.y) / tileSize;

      // Snap to nearest half-tile (0.5 inch grid)
      const snappedX = Math.round(x * 2) / 2;
      const snappedY = Math.round(y * 2) / 2;

      // Clamp X position to canvas bounds, but allow Y to go below canvas for returning to available area
      const clampedX = Math.max(0, Math.min(snappedX, totalWidth - draggedSquare.width));
      const clampedY = snappedY; // Don't clamp Y - allow dragging below canvas

      setDraggedSquare(prev => prev ? { ...prev, x: clampedX, y: clampedY } : null);
    };

    const handleDocumentMouseUp = () => {
      if (!draggedSquare) return;

      const finalSquare = draggedSquare;

      // Check if square is within the canvas bounds (including buffer areas)
      // Allow placement anywhere in the canvas, but allow dragging below to return to available area
      const isWithinCanvas = finalSquare.x >= 0 && finalSquare.x <= totalWidth - finalSquare.width &&
                             finalSquare.y >= 0 && finalSquare.y <= totalHeight - finalSquare.height;

      if (isWithinCanvas) {
        // Find nearest available position without overlapping
        const snappedPosition = findNearestAvailablePosition(finalSquare, quiltSquares, quilt);
        onSquareUpdate(finalSquare.id, snappedPosition.x, snappedPosition.y, true);
      } else {
        // Return to extra space - square was dragged outside the canvas bounds
        const extraSpaceX = Math.max(0, Math.min(finalSquare.x, totalWidth - finalSquare.width));
        onSquareUpdate(finalSquare.id, extraSpaceX, totalHeight + 2, false);
      }

      setDraggedSquare(null);
    };

    const handleDocumentTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!draggedSquare) return;

      const finalSquare = draggedSquare;

      // Check if square is within the canvas bounds (including buffer areas)
      // Allow placement anywhere in the canvas, but allow dragging below to return to available area
      const isWithinCanvas = finalSquare.x >= 0 && finalSquare.x <= totalWidth - finalSquare.width &&
                             finalSquare.y >= 0 && finalSquare.y <= totalHeight - finalSquare.height;

      if (isWithinCanvas) {
        // Find nearest available position without overlapping
        const snappedPosition = findNearestAvailablePosition(finalSquare, quiltSquares, quilt);
        onSquareUpdate(finalSquare.id, snappedPosition.x, snappedPosition.y, true);
      } else {
        // Return to extra space - square was dragged outside the canvas bounds
        const extraSpaceX = Math.max(0, Math.min(finalSquare.x, totalWidth - finalSquare.width));
        onSquareUpdate(finalSquare.id, extraSpaceX, totalHeight + 2, false);
      }

      setDraggedSquare(null);
    };

    document.addEventListener('mousemove', handleDocumentMouseMove);
    document.addEventListener('mouseup', handleDocumentMouseUp);
    document.addEventListener('touchmove', handleDocumentTouchMove, { passive: false } as AddEventListenerOptions);
    document.addEventListener('touchend', handleDocumentTouchEnd, { passive: false } as AddEventListenerOptions);

    return () => {
      document.removeEventListener('mousemove', handleDocumentMouseMove);
      document.removeEventListener('mouseup', handleDocumentMouseUp);
      document.removeEventListener('touchmove', handleDocumentTouchMove, { passive: false } as AddEventListenerOptions);
      document.removeEventListener('touchend', handleDocumentTouchEnd, { passive: false } as AddEventListenerOptions);
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

  const handleTouchStart = useCallback((e: React.TouchEvent, square: QuiltSquare) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const touch = e.touches[0];
    if (!touch) return;
    setDraggedSquare(square);
    setDragOffset({
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top
    });
  }, []);

  // Simplified handlers - document-level events handle the actual dragging
  const handleMouseMove = useCallback(() => {
    // Document-level mousemove handles the actual dragging
  }, []);

  const handleMouseUp = useCallback(() => {
    // Document-level mouseup handles the drop logic
  }, []);

  const startEditingSquare = useCallback((square: QuiltSquare) => {
    setEditingSquare(square);
    setEditWidth(square.width);
    setEditHeight(square.height);
  }, []);

  const cancelEditingSquare = useCallback(() => {
    setEditingSquare(null);
  }, []);

  const saveSquareDimensions = useCallback(() => {
    if (editingSquare) {
      onSquareDimensionUpdate(editingSquare.id, editWidth, editHeight);
      setEditingSquare(null);
    }
  }, [editingSquare, editWidth, editHeight, onSquareDimensionUpdate]);

  // Calculate total canvas dimensions including buffer
  const totalWidth = quilt.width + 2 * buffer;
  const totalHeight = quilt.height + 2 * buffer;

  return (
    <div className="quilt-canvas" ref={canvasRef}>
      <div
        className="quilt-area"
        style={{
          width: totalWidth * tileSize,
          height: totalHeight * tileSize,
          border: '2px solid var(--border-light)',
          position: 'relative',
          marginBottom: '40px',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '12px',
          boxShadow: 'var(--shadow-lg)'
        }}
      >
        {/* Render grid lines for entire buffer area */}
        {Array.from({ length: Math.ceil(totalWidth) + 1 }, (_, i) => (
          <div
            key={`v-${i}`}
            style={{
              position: 'absolute',
              left: i * tileSize,
              top: 0,
              width: '1px',
              height: '100%',
              backgroundColor: 'var(--border-color)'
            }}
          />
        ))}
        {Array.from({ length: Math.ceil(totalHeight) + 1 }, (_, i) => (
          <div
            key={`h-${i}`}
            style={{
              position: 'absolute',
              top: i * tileSize,
              left: 0,
              height: '1px',
              width: '100%',
              backgroundColor: 'var(--border-color)'
            }}
          />
        ))}

        {/* Render buffer background tiles */}
        {Array.from({ length: Math.ceil(totalWidth) }, (_, x) => (
          Array.from({ length: Math.ceil(totalHeight) }, (_, y) => {
            const isInMainQuilt = x >= buffer && x < buffer + quilt.width && y >= buffer && y < buffer + quilt.height;
            return (
              <div
                key={`buffer-${x}-${y}`}
                style={{
                  position: 'absolute',
                  left: x * tileSize,
                  top: y * tileSize,
                  width: tileSize,
                  height: tileSize,
                  backgroundColor: isInMainQuilt ? 'transparent' : 'var(--bg-accent)', // darker grey for buffer
                  border: isInMainQuilt ? 'none' : '1px solid var(--border-color)',
                  zIndex: 0
                }}
              />
            );
          })
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
              borderRadius: '6px',
              cursor: 'grab',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              color: square.imageData ? 'transparent' : 'var(--text-primary)',
              userSelect: 'none',
              boxShadow: 'var(--shadow)'
            }}
            onMouseDown={(e) => handleMouseDown(e, square)}
            onTouchStart={(e) => handleTouchStart(e, square)}
          >
            {!square.imageData && `${square.width}" × ${square.height}"`}
          </div>
        ))}

        {/* Render dragged square*/}
        {draggedSquare && (
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
              borderRadius: '6px',
              opacity: 0.8,
              pointerEvents: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              color: draggedSquare.imageData ? 'transparent' : 'var(--text-primary)',
              boxShadow: 'var(--shadow-lg)'
            }}
          >
            {!draggedSquare.imageData && `${draggedSquare.width}" × ${draggedSquare.height}"`}
          </div>
        )}
      </div>

      <div className="bottom-section" style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
        <div className="square-creator-section">
          <h2>Add New Square</h2>
          {squareCreator}
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
              border: '1px dashed var(--border-color)',
              borderRadius: '8px',
              background: 'var(--bg-tertiary)'
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
                  borderRadius: '6px',
                  cursor: 'grab',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  color: square.imageData ? 'transparent' : 'var(--text-primary)',
                  userSelect: 'none',
                  position: 'relative',
                  boxShadow: 'var(--shadow)'
                }}
                onMouseDown={(e) => handleMouseDown(e, square)}
            onTouchStart={(e) => handleTouchStart(e, square)}
              >
                {!square.imageData && `${square.width}" × ${square.height}"`}
                <button
                  type="button"
                  className="edit-square-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    startEditingSquare(square);
                  }}
                  onTouchStart={(e) => {
                    e.stopPropagation();
                  }}
                  title="Edit dimensions"
                >
                  {square.width} × {square.height} ✏️
                </button>
              </div>
            ))}


          </div>

          {/* Edit Dimensions Modal */}
          {editingSquare && (
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                backdropFilter: 'blur(4px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000
              }}
              onClick={cancelEditingSquare}
            >
              <div
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  padding: '20px',
                  borderRadius: '12px',
                  border: '1px solid var(--border-color)',
                  minWidth: '250px',
                  boxShadow: 'var(--shadow-lg)'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <h3 style={{ marginTop: 0, marginBottom: '15px', color: 'var(--text-primary)', fontWeight: '600' }}>Edit Square Dimensions</h3>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px' }}>
                    Width (inches):
                    <input
                      type="number"
                      min="1"
                      step="0.5"
                      value={editWidth}
                      onChange={(e) => setEditWidth(parseFloat(e.target.value) || 1)}
                      style={{
                        width: '100%',
                        padding: '8px',
                        marginTop: '2px',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        background: 'var(--bg-accent)',
                        color: 'var(--text-primary)'
                      }}
                    />
                  </label>
                </div>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '5px' }}>
                    Height (inches):
                    <input
                      type="number"
                      min="1"
                      step="0.5"
                      value={editHeight}
                      onChange={(e) => setEditHeight(parseFloat(e.target.value) || 1)}
                      style={{
                        width: '100%',
                        padding: '8px',
                        marginTop: '2px',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        background: 'var(--bg-accent)',
                        color: 'var(--text-primary)'
                      }}
                    />
                  </label>
                </div>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={cancelEditingSquare}
                    style={{
                      padding: '8px 16px',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                      backgroundColor: 'var(--bg-accent)',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={saveSquareDimensions}
                    style={{
                      padding: '8px 16px',
                      border: 'none',
                      borderRadius: '6px',
                      backgroundColor: 'var(--accent-green)',
                      color: 'white',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    Save
                  </button>
                </div>
              </div>
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
  const totalWidth = quilt.width + 2 * quilt.buffer;
  const totalHeight = quilt.height + 2 * quilt.buffer;
  const { width: squareWidth, height: squareHeight } = draggedSquare;

  // Snap the dragged position to nearest half-tile and clamp to buffer area bounds
  let bestX = Math.max(0, Math.min(Math.round(draggedSquare.x * 2) / 2, totalWidth - squareWidth));
  let bestY = Math.max(0, Math.min(Math.round(draggedSquare.y * 2) / 2, totalHeight - squareHeight));

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

  for (let y = 0; y <= totalHeight - squareHeight; y += step) {
    // Ensure y is snapped to half-tile
    const snappedY = Math.round(y * 2) / 2;
    for (let x = 0; x <= totalWidth - squareWidth; x += step) {
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
