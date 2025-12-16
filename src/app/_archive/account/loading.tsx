export default function AccountLoading() {
  return (
    <div className="max-w-7xl xl:max-w-[90rem] 2xl:max-w-[100rem] mx-auto p-[10px]">
      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-3">
        {/* Sidebar skeleton */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="bg-white border border-gray-200 rounded-md p-[10px]">
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-8 bg-gray-100 rounded-md animate-pulse" />
              ))}
            </div>
          </div>
        </aside>
        
        {/* Content skeleton */}
        <main className="min-w-0">
          <div className="space-y-3">
            <div className="h-6 bg-gray-100 rounded-md w-1/3 animate-pulse" />
            <div className="h-32 bg-gray-100 rounded-md animate-pulse" />
            <div className="h-48 bg-gray-100 rounded-md animate-pulse" />
          </div>
        </main>
      </div>
    </div>
  );
}

