// Avatar UI Component
function Avatar({ className = "", children }) {
  return (
    <div className={`${className} relative flex shrink-0 overflow-hidden rounded-full`}>
      {children}
    </div>
  );
}

function AvatarImage({ src, alt = "" }) {
  return src ? (
    <img
      className="aspect-square h-full w-full object-cover"
      src={src}
      alt={alt}
    />
  ) : null;
}

function AvatarFallback({ children }) {
  return (
    <div className="flex h-full w-full items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-medium">
      {children}
    </div>
  );
}

// Named exports
export { Avatar, AvatarImage, AvatarFallback };

// Default export (optional - exports the main Avatar component)
export default Avatar;