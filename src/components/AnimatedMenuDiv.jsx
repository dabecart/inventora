import { motion } from "framer-motion";

export default function AnimatedMenuDiv({ children, keyName = ' ', className = null, direction = 1 }) {
  const slideVariants = {
    enter: (direction) => ({
      x: direction > 0 ? -100 : 100,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction) => ({
      x: direction > 0 ? 100 : -100,
      opacity: 0,
    }),
  };

  return (
    <motion.div
      key={keyName}
      custom={direction}
      variants={slideVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ duration: 0.3 }}
      className={`flex flex-col flex-1 ${className || ''}`}
    >
      {children}
    </motion.div>
  )
}