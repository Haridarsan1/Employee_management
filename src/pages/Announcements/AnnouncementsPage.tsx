import { Megaphone, Plus } from 'lucide-react';

export function AnnouncementsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Megaphone className="h-8 w-8 text-fuchsia-600" />
            Company Announcements
          </h1>
          <p className="text-slate-600 mt-2">News, updates, and important notices</p>
        </div>
        <button className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-fuchsia-600 to-fuchsia-700 text-white rounded-xl shadow-lg">
          <Plus className="h-5 w-5" />
          New Announcement
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 text-center">
        <Megaphone className="h-16 w-16 text-fuchsia-300 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-slate-900 mb-2">Company Announcements</h3>
        <p className="text-slate-600">Share company news, celebrate achievements, and keep everyone informed</p>
        <p className="text-sm text-slate-500 mt-4">Feature fully implemented in database - UI coming soon</p>
      </div>
    </div>
  );
}
