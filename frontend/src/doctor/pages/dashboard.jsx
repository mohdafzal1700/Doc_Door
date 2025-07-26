import DocHeader from "../../components/ui/DocHeader"
import DoctorSidebar from "../../components/ui/DocSide"

export default function DocDashboard() {
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <DocHeader />
      
      <div className="flex">
        {/* Sidebar */}
        <DoctorSidebar />
        
        {/* Main Content */}
        <main className="flex-1 p-8">
          <h1 className="text-3xl font-semibold text-gray-900">Dashboard</h1>
        </main>
      </div>
    </div>
  )
}