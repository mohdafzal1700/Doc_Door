const HeaderLogo = () => {
  return (
    <div className="flex items-center space-x-3">
      <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
        <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
        </svg>
      </div>
      <span className="text-xl font-bold text-gray-900 dark:text-white">DOC-DOOR</span>
    </div>
  )
}

export default HeaderLogo
