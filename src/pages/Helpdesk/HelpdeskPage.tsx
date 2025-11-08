import { useState } from 'react';
import { Headphones, Plus } from 'lucide-react';

export function HelpdeskPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Headphones className="h-8 w-8 text-pink-600" />
            Helpdesk & Support
          </h1>
          <p className="text-slate-600 mt-2">IT, HR, and Admin support tickets</p>
        </div>
        <button className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-pink-600 to-pink-700 text-white rounded-xl shadow-lg">
          <Plus className="h-5 w-5" />
          New Ticket
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 text-center">
        <Headphones className="h-16 w-16 text-pink-300 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-slate-900 mb-2">Support Tickets</h3>
        <p className="text-slate-600">Create and track IT, HR, and facility support requests</p>
        <p className="text-sm text-slate-500 mt-4">Feature fully implemented in database - UI coming soon</p>
      </div>
    </div>
  );
}
