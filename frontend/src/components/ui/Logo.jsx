const Logo = () => {
    return (
        <div className="flex flex-col items-center mb-6">
        <div className="w-16 h-16 bg-white rounded-lg border-2 border-purple-500 flex items-center justify-center mb-3">
            <svg className="w-8 h-8 text-purple-500" fill="currentColor" viewBox="0 0 24 24">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
            </svg>
        </div>
        <h1 className="text-xl font-semibold text-gray-800">DOC-DOOR</h1>
        </div>
    )
}

export default Logo