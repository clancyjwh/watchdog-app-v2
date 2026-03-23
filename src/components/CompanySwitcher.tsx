import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Building2, ChevronDown, Plus } from 'lucide-react';

export default function CompanySwitcher() {
  const { currentCompany, companies, switchCompany } = useAuth();
  const navigate = useNavigate();
  const [showDropdown, setShowDropdown] = useState(false);

  const handleSwitch = async (companyId: string) => {
    await switchCompany(companyId);
    setShowDropdown(false);
  };

  const handleAddCompany = () => {
    setShowDropdown(false);
    navigate('/add-company');
  };

  if (!currentCompany) return null;

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <Building2 className="w-4 h-4" />
          <span className="max-w-[150px] truncate">{currentCompany.name}</span>
          <ChevronDown className="w-4 h-4" />
        </button>

        {showDropdown && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setShowDropdown(false)}
            />
            <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
              <div className="p-2 border-b border-gray-200">
                <p className="text-xs text-gray-500 px-2 py-1">Switch Company</p>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {companies.map((company) => (
                  <button
                    key={company.id}
                    onClick={() => handleSwitch(company.id)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${
                      company.id === currentCompany.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{company.name}</span>
                    </div>
                  </button>
                ))}
              </div>
              <div className="p-2 border-t border-gray-200">
                <button
                  onClick={handleAddCompany}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Company
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
