export const VideoCallManager = ({ children }) => {
  const [currentUserId, setCurrentUserId] = useState(null);

  useEffect(() => {
    const userId = getCurrentUserId();
    if (userId) {
      console.log("Logged-in user's ID:", userId);
      setCurrentUserId(userId);
    }
  }, []);

  if (!currentUserId) return children; // Skip initializing video if user not logged in

  return (
    <VideoCallProvider currentUserId={currentUserId}>
      {children}
      <IncomingCallModal />
      <VideoCallInterface />
    </VideoCallProvider>
  );
};
