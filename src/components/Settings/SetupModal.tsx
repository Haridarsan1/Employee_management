import { X, CheckCircle2, Circle, Settings } from 'lucide-react';

interface SetupModalProps {
  open: boolean;
  onClose: () => void;
  onNavigateToSettings: () => void;
  setupStatus: {
    hasDepartments: boolean;
    hasDesignations: boolean;
    hasBranches: boolean;
  };
}

export function SetupModal({ open, onClose, onNavigateToSettings, setupStatus }: SetupModalProps) {
  if (!open) return null;

  const isSetupComplete = setupStatus.hasDepartments && setupStatus.hasDesignations;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-white/20 rounded-xl">
              <Settings className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-bold">First-Time Setup Required</h2>
          </div>
          <p className="text-blue-100">Complete your organization setup to get started</p>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="mb-6">
            <p className="text-slate-700 leading-relaxed">
              Before you can add employees or use major features of the system, you need to configure your organization's master data.
            </p>
          </div>

          {/* Checklist */}
          <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 mb-6">
            <h3 className="text-sm font-semibold text-slate-900 mb-4 uppercase tracking-wide">
              Setup Checklist
            </h3>
            <div className="space-y-3">
              {/* Departments */}
              <div className="flex items-start gap-3">
                {setupStatus.hasDepartments ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                ) : (
                  <Circle className="h-5 w-5 text-slate-400 mt-0.5 flex-shrink-0" />
                )}
                <div>
                  <p className={`font-medium ${setupStatus.hasDepartments ? 'text-green-700' : 'text-slate-700'}`}>
                    Departments
                  </p>
                  <p className="text-sm text-slate-500">
                    {setupStatus.hasDepartments ? 'Configured' : 'Required - Add at least one department (e.g., IT, HR, Sales)'}
                  </p>
                </div>
              </div>

              {/* Designations */}
              <div className="flex items-start gap-3">
                {setupStatus.hasDesignations ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                ) : (
                  <Circle className="h-5 w-5 text-slate-400 mt-0.5 flex-shrink-0" />
                )}
                <div>
                  <p className={`font-medium ${setupStatus.hasDesignations ? 'text-green-700' : 'text-slate-700'}`}>
                    Designations
                  </p>
                  <p className="text-sm text-slate-500">
                    {setupStatus.hasDesignations ? 'Configured' : 'Required - Add at least one designation (e.g., Manager, Developer)'}
                  </p>
                </div>
              </div>

              {/* Branches */}
              <div className="flex items-start gap-3">
                {setupStatus.hasBranches ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                ) : (
                  <Circle className="h-5 w-5 text-slate-400 mt-0.5 flex-shrink-0" />
                )}
                <div>
                  <p className={`font-medium ${setupStatus.hasBranches ? 'text-green-700' : 'text-slate-700'}`}>
                    Branches
                  </p>
                  <p className="text-sm text-slate-500">
                    {setupStatus.hasBranches ? 'Configured' : 'Optional - Add office locations if needed'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onNavigateToSettings}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2"
            >
              <Settings className="h-5 w-5" />
              Go to Master Data Setup
            </button>
            <button
              onClick={onClose}
              className="px-6 py-3 bg-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-300 transition-colors"
            >
              Later
            </button>
          </div>

          {/* Footer Note */}
          {!isSetupComplete && (
            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <p className="text-sm text-amber-800">
                <strong>Note:</strong> This popup will continue to appear until you complete the required setup (Departments and Designations).
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
