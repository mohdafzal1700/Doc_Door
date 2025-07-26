import React, { forwardRef } from 'react';

// ScrollArea Component (since it's not available)
const ScrollArea = forwardRef(({ className, children }, ref) => {
  return (
    <div 
      ref={ref}
      className={`${className} overflow-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent`}
      style={{
        scrollbarWidth: 'thin',
        scrollbarColor: '#d1d5db transparent'
      }}
    >
      {children}
    </div>
  );
});

ScrollArea.displayName = 'ScrollArea';

export default ScrollArea;
