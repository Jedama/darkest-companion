// src/components/ui/ImageButton/ImageButton.tsx
import React, {
    FC,
    useEffect,
    useRef,
    useState,
    MouseEvent,
    CSSProperties,
  } from 'react';
  
  interface ImageButtonProps {
    /** URL of your PNG with transparency */
    textureUrl: string;
    /** Display width in CSS px */
    width?: number;
    /** Display height in CSS px */
    height?: number;
    /** Called if user clicks on a non-transparent pixel */
    onClick?: () => void;
    /** Optional inline styles */
    style?: CSSProperties;
    /** Optional CSS class name to apply to the button's root div */
    className?: string;
  }
  
  /**
   * A pixel-perfect clickable image button:
   * - Ignores clicks on fully-transparent pixels
   * - Only triggers "hover" for nontransparent areas
   */
  export const ImageButton: FC<ImageButtonProps> = ({
    textureUrl,
    width,
    height,
    onClick,
    style,
    className,
  }) => {
    const [isHovered, setIsHovered] = useState(false);
  
    // We'll display the image in a normal <img> so it can easily scale, animate, etc.
    const imgRef = useRef<HTMLImageElement>(null);
  
    // We'll use an *offscreen* <canvas> to hold pixel data for the alpha check
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [imgLoaded, setImgLoaded] = useState(false);
  
    useEffect(() => {
      const img = imgRef.current;
      const canvas = canvasRef.current;
      if (!img || !canvas) return;
  
      // Whenever the image loads, draw it to the offscreen canvas
      const handleLoad = () => {
        const ctx = canvas.getContext('2d');
        if (!ctx || !img) return;
  
        // Make sure canvas matches the NATURAL image width/height!
        // not the CSS display width/height
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
  
        // Draw the image onto the canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
  
        setImgLoaded(true);
      };
  
      // If it's already loaded (cached?), call handleLoad immediately
      if (img.complete && img.naturalWidth > 0) {
        handleLoad();
      } else {
        img.addEventListener('load', handleLoad);
        // Cleanup
        return () => {
          img.removeEventListener('load', handleLoad);
        };
      }
    }, [textureUrl]);
  
    /**
     * We do the alpha check in the image’s natural coordinates.
     * Then we map the mouse's local (x, y) to those coordinates.
     */
    const handleMouseEvent = (evt: MouseEvent<HTMLDivElement>) => {
      if (!imgLoaded) {
        // If the image isn’t loaded, can’t do alpha checks
        setIsHovered(false);
        return;
      }
      const canvas = canvasRef.current;
      const img = imgRef.current;
      if (!canvas || !img) return;
  
      const rect = evt.currentTarget.getBoundingClientRect();
      // Mouse position relative to the top-left corner of the *rendered* container
      const mouseX = evt.clientX - rect.left;
      const mouseY = evt.clientY - rect.top;
  
      // Convert that to the image's NATURAL coords
      // For instance, if you’re scaling the image from its natural size to the displayed size:
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
  
      const realX = Math.floor(mouseX * scaleX);
      const realY = Math.floor(mouseY * scaleY);
  
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Add bounds check to prevent errors if mouse is outside canvas dimensions (e.g., due to rounding or padding)
      if (realX < 0 || realX >= canvas.width || realY < 0 || realY >= canvas.height) {
          setIsHovered(false);
          if (evt.type === 'click' && onClick) {
              // Optionally, handle clicks outside the valid pixel area differently
          }
          return;
      }
  
      // Get pixel data from the offscreen canvas
      const pixel = ctx.getImageData(realX, realY, 1, 1).data; 
      // pixel: [r, g, b, a]
  
      const alpha = pixel[3];
      const isOpaque = alpha > 0;
  
      // Update hover state if needed
      setIsHovered(isOpaque);
  
      // If it's a click event, call onClick only if pixel is opaque
      if (evt.type === 'click' && isOpaque && onClick) {
        onClick();
      }
    };
  
    // Combine the external className with our internal pixel-perfect hover class
    const rootClasses = `${className || ''} ${isHovered ? 'is-hovered-opaque' : ''}`.trim();

    return (
      <div
        className={rootClasses}
        style={{
          position: 'relative',
          ...(width !== undefined && { width: width }),
          ...(height !== undefined && { height: height }),
          display: 'inline-block',
          pointerEvents: 'auto', // Ensure this div always receives events
          ...style,
        }}
        onMouseMove={handleMouseEvent}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleMouseEvent}
      >
        {/* 
          The actual displayed image: 
          - We set pointerEvents="none" so we let the parent <div> handle the mouse.
        */}
        <img
          ref={imgRef}
          src={textureUrl}
          alt=""
          style={{
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            transition: 'transform 0.2s ease, filter 0.2s ease',
            // Example "grow/glow" if hovered
            transform: isHovered ? 'scale(1.05)' : undefined,
            filter: isHovered ? 'drop-shadow(0 0 6px white)' : undefined,
          }}
          draggable={false}
        />
  
        {/* 
          Offscreen canvas just for pixel-level detection.
          We can set display: none, or we can keep it hidden in some other way.
        */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>
    );
  };
  