import { useState, useCallback } from "react";
import "./index.css";

const TILE_SIZE = 20; // 1 inch = 20px

interface QuiltSquare {
  id: string;
  name: string;
  width: number; // in inches
  height: number; // in inches
  color: string;
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

  const addSquare = useCallback((name: string, width: number, height: number) => {
    const colors: string[] = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)]!;

    const newSquare: QuiltSquare = {
      id: Date.now().toString(),
      name,
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

function SquareCreator({ onAddSquare }: { onAddSquare: (name: string, width: number, height: number) => void }) {
  const [name, setName] = useState('');
  const [width, setWidth] = useState(12);
  const [height, setHeight] = useState(12);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onAddSquare(name, width, height);
      setName('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="square-form">
      <label>
        Name:
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </label>
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
      <button type="submit">Add Square</button>
    </form>
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

  const quiltSquares = squares.filter(square => square.isInQuilt);
  const extraSquares = squares.filter(square => !square.isInQuilt);

  const handleMouseDown = useCallback((e: React.MouseEvent, square: QuiltSquare) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setDraggedSquare(square);
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!draggedSquare) return;

    const containerRect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - containerRect.left - dragOffset.x) / tileSize;
    const y = (e.clientY - containerRect.top - dragOffset.y) / tileSize;

    // Snap to nearest half-tile (0.5 inch grid)
    const snappedX = Math.round(x * 2) / 2;
    const snappedY = Math.round(y * 2) / 2;

    // Clamp to quilt area if dragging within quilt
    const clampedX = Math.max(0, Math.min(snappedX, quilt.width - draggedSquare.width));
    const clampedY = Math.max(0, Math.min(snappedY, quilt.height - draggedSquare.height));

    setDraggedSquare(prev => prev ? { ...prev, x: clampedX, y: clampedY } : null);
  }, [draggedSquare, dragOffset, tileSize, quilt.width, quilt.height]);

  const handleMouseUp = useCallback(() => {
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
      // Return to extra space
      onSquareUpdate(finalSquare.id, 0, quilt.height + 2, false);
    }

    setDraggedSquare(null);
  }, [draggedSquare, quiltSquares, quilt, onSquareUpdate]);

  return (
    <div className="quilt-canvas">
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
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
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
              backgroundColor: square.color,
              border: '1px solid #333',
              cursor: 'grab',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              color: '#333',
              userSelect: 'none'
            }}
            onMouseDown={(e) => handleMouseDown(e, square)}
          >
            {square.name}
          </div>
        ))}

        {/* Render dragged square */}
        {draggedSquare && draggedSquare.isInQuilt && (
          <div
            className="square dragging"
            style={{
              position: 'absolute',
              left: draggedSquare.x * tileSize,
              top: draggedSquare.y * tileSize,
              width: draggedSquare.width * tileSize,
              height: draggedSquare.height * tileSize,
              backgroundColor: draggedSquare.color,
              border: '2px dashed #333',
              opacity: 0.7,
              pointerEvents: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              color: '#333'
            }}
          >
            {draggedSquare.name}
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
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          {extraSquares.map(square => (
            <div
              key={square.id}
              className={`square ${draggedSquare?.id === square.id ? 'dragging' : ''}`}
              style={{
                width: square.width * tileSize,
                height: square.height * tileSize,
                backgroundColor: square.color,
                border: '1px solid #333',
                cursor: 'grab',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                color: '#333',
                userSelect: 'none'
              }}
              onMouseDown={(e) => handleMouseDown(e, square)}
            >
              {square.name}
            </div>
          ))}

          {/* Render dragged square from extra space */}
          {draggedSquare && !draggedSquare.isInQuilt && (
            <div
              className="square dragging"
              style={{
                position: 'absolute',
                left: draggedSquare.x * tileSize,
                top: draggedSquare.y * tileSize,
                width: draggedSquare.width * tileSize,
                height: draggedSquare.height * tileSize,
                backgroundColor: draggedSquare.color,
                border: '2px dashed #333',
                opacity: 0.7,
                pointerEvents: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                color: '#333'
              }}
            >
              {draggedSquare.name}
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
