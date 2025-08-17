// Create this file: src/components/GoogleCallback.jsx or src/pages/GoogleCallback.jsx
import { useEffect } from 'react'

const GoogleCallback = () => {
  useEffect(() => {
    const handleCallback = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search)
        const code = urlParams.get('code')
        const state = urlParams.get('state')
        const error = urlParams.get('error')

        if (error) {
          console.error('❌ Google OAuth Error:', error)
          // Send error message to parent window
          window.opener?.postMessage({
            type: 'GOOGLE_AUTH_ERROR',
            error: error
          }, window.location.origin)
          window.close()
          return
        }

        if (code) {
          console.log('🔑 Received authorization code from Google')
          
          // You can either:
          // 1. Send the code to your backend to exchange for tokens
          // 2. Exchange it directly in the frontend (less secure)
          
          // Option 1: Send to backend (recommended)
          const response = await fetch('/api/auth/google', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ code, state })
          })

          if (response.ok) {
            const data = await response.json()
            // Send success message to parent window
            window.opener?.postMessage({
              type: 'GOOGLE_AUTH_SUCCESS',
              credential: data.id_token || data.access_token,
              user: data.user
            }, window.location.origin)
          } else {
            throw new Error('Failed to authenticate with backend')
          }
        }
      } catch (error) {
        console.error('❌ Callback handling error:', error)
        window.opener?.postMessage({
          type: 'GOOGLE_AUTH_ERROR',
          error: error.message
        }, window.location.origin)
      } finally {
        // Close the popup window
        window.close()
      }
    }

    handleCallback()
  }, [])

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Processing Google authentication...</p>
      </div>
    </div>
  )
}

export default GoogleCallback