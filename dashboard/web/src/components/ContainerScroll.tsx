import React, { useRef, useState, useEffect } from "react";
import { useScroll, useTransform, motion, MotionValue } from "framer-motion";

export const ContainerScroll = ({
  titleComponent,
  children,
}: {
  titleComponent: string | React.ReactNode;
  children: React.ReactNode;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "center center"],
  });

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const scaleDimensions = () => {
    return isMobile ? [0.9, 0.98] : [0.92, 1];
  };

  const rotate = useTransform(scrollYProgress, [0, 1], [25, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], scaleDimensions());
  const translateY = useTransform(scrollYProgress, [0, 1], [40, 0]);

  return (
    <div
      className="py-12 md:py-24 flex items-center justify-center relative px-4 sm:px-12"
      ref={containerRef}
    >
      <div
        className="w-full relative max-w-screen-2xl mx-auto"
        style={{
          perspective: "1200px",
        }}
      >
        <Header translateY={translateY} titleComponent={titleComponent} />
        <Card rotate={rotate} scale={scale}>
          {children}
        </Card>
      </div>
    </div>
  );
};

export const Header = ({
  translateY,
  titleComponent,
}: {
  translateY: MotionValue<number>;
  titleComponent: React.ReactNode;
}) => {
  return (
    <motion.div
      style={{
        translateY,
      }}
      className="max-w-5xl mx-auto text-center mb-8"
    >
      {titleComponent}
    </motion.div>
  );
};

export const Card = ({
  rotate,
  scale,
  children,
}: {
  rotate: MotionValue<number>;
  scale: MotionValue<number>;
  children: React.ReactNode;
}) => {
  return (
    <motion.div
      style={{
        rotateX: rotate,
        scale,
        boxShadow:
          "0 25px 50px -12px rgba(0, 0, 0, 0.9), 0 0 40px rgba(255, 220, 161, 0.05)",
      }}
      className="max-w-5xl mx-auto w-full border border-[#333333] p-2 md:p-4 bg-black rounded-none transition-shadow duration-300"
    >
      <div className="h-full w-full overflow-hidden bg-black rounded-none font-sans">
        {children}
      </div>
    </motion.div>
  );
};
