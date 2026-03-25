

          {currentStep === 5 && (
            <div className="space-y-10 flex-1">
              <div className="max-w-xl text-left">
                <h2 className="text-4xl font-black text-white tracking-tight leading-none mb-4">Source <span className="text-blue-500 underline decoration-blue-500/20 underline-offset-8">Types</span></h2>
                <p className="text-slate-400 font-bold leading-relaxed pr-8">
                  Select the types of content you want us to monitor across the web for the most relevant updates.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-5 text-left">
                {CONTENT_TYPES.map((type) => {
                  const Icon = type.icon;
                  const isSelected = selectedContentTypes.includes(type.id);
                  return (
                    <button
                      key={type.id}
                      onClick={() => toggleContentType(type.id)}
                      className={`group p-6 rounded-[24px] border-2 text-left transition-all duration-300 ${
                        isSelected
                          ? 'border-blue-600 bg-blue-600/5 shadow-2xl shadow-blue-500/10'
                          : 'border-slate-800 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/60'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div className={`p-3 rounded-2xl transition-all duration-300 ${
                          isSelected
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                            : 'bg-slate-800 text-slate-500 group-hover:text-slate-400'
                        }`}>
                          <Icon className="w-6 h-6" strokeWidth={2.5} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-[11px] font-black uppercase tracking-widest ${
                              isSelected ? 'text-white' : 'text-slate-500'
                            }`}>{type.label}</span>
                            {isSelected && (
                              <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center">
                                 <Check className="w-3 h-3 text-white" strokeWidth={4} />
                              </div>
                            )}
                          </div>
                          <p className="text-[10px] font-bold text-slate-500 leading-tight">Custom monitoring</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {currentStep === 6 && (
            <div className="space-y-10 flex-1">
              <div className="max-w-xl text-left">
                <h2 className="text-4xl font-black text-white tracking-tight leading-none mb-4">Review <span className="text-blue-500 underline decoration-blue-500/20 underline-offset-8">Your Setup</span></h2>
                <p className="text-slate-400 font-bold leading-relaxed pr-8">
                  Review your business profile and monitoring settings before we start your daily scans.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10 text-left">
                <div className="space-y-8">
                  <div className="bg-slate-900/40 rounded-3xl p-6 border border-slate-800/50">
                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Business Profile</h3>
                    <div className="space-y-3">
                       <div className="flex justify-between items-center">
                          <span className="text-[11px] font-bold text-slate-600 uppercase">Company</span>
                          <span className="text-sm font-black text-white">{companyName}</span>
                       </div>
                       <div className="flex justify-between items-center">
                          <span className="text-[11px] font-bold text-slate-600 uppercase">Industry</span>
                          <span className="text-sm font-black text-white">{industry}</span>
                       </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Monitored Topics ({selectedTopics.length})</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedTopics.slice(0, 8).map((topic) => (
                        <span key={topic} className="px-3 py-1.5 bg-slate-800 text-white rounded-lg text-[10px] font-black uppercase tracking-tight">
                          {topic}
                        </span>
                      ))}
                      {selectedTopics.length > 8 && (
                        <span className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[10px] font-black uppercase">
                          +{selectedTopics.length - 8} More
                        </span>
                      )}
                    </div>
                  </div>

          {currentStep === 5 && (
            <div className="space-y-10 flex-1">
              <div className="max-w-xl text-left">
                <h2 className="text-4xl font-black text-white tracking-tight leading-none mb-4 uppercase italic underline decoration-blue-500/20 underline-offset-8">Intelligence <span className="text-blue-500">Filters</span></h2>
                <p className="text-slate-400 font-bold leading-relaxed pr-8">
                  Define the types of signals our AI should prioritize while scanning global data feeds.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {CONTENT_TYPES.map((filter) => {
                  const Icon = filter.icon;
                  return (
                    <button
                      key={filter.id}
                      onClick={() => {
                        if (selectedContentTypes.includes(filter.id)) {
                          setSelectedContentTypes(selectedContentTypes.filter((f) => f !== filter.id));
                        } else {
                          setSelectedContentTypes([...selectedContentTypes, filter.id]);
                        }
                      }}
                      className={`group relative p-8 rounded-[32px] border-2 text-left transition-all duration-300 ${
                        selectedContentTypes.includes(filter.id)
                          ? 'border-blue-600 bg-blue-600/5 shadow-2xl shadow-blue-500/10 scale-[1.05]'
                          : 'border-slate-800 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/60'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-6">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                          selectedContentTypes.includes(filter.id) ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'bg-slate-800 text-slate-500 group-hover:bg-slate-700'
                        }`}>
                          <Icon className="w-6 h-6" strokeWidth={2.5} />
                        </div>
                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center border-2 transition-all ${
                          selectedContentTypes.includes(filter.id) ? 'bg-blue-600 border-blue-600' : 'border-slate-800 bg-slate-950'
                        }`}>
                          {selectedContentTypes.includes(filter.id) && <Check className="w-3.5 h-3.5 text-white" strokeWidth={4} />}
                        </div>
                      </div>
                      
                      <h3 className="text-sm font-black text-white uppercase tracking-widest mb-2">{filter.label}</h3>
                      <p className="text-[10px] font-bold text-slate-500 leading-relaxed uppercase tracking-tight">
                        Automatic prioritization of {filter.label.toLowerCase()} across global feeds.
                      </p>

                      {selectedContentTypes.includes(filter.id) && (
                        <div className="absolute -bottom-1 -right-1 w-24 h-24 bg-blue-600/10 blur-3xl rounded-full pointer-events-none" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {currentStep === 6 && (
            <div className="space-y-10 flex-1">
              <div className="max-w-xl text-left">
                <h2 className="text-4xl font-black text-white tracking-tight leading-none mb-4 uppercase italic underline decoration-blue-500/20 underline-offset-8">Review <span className="text-blue-500">Configuration</span></h2>
                <p className="text-slate-400 font-bold leading-relaxed pr-8">
                  Validate your intelligence vectors before deploying the automated monitoring system.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="p-10 bg-slate-900/40 rounded-[40px] border border-slate-800/50 space-y-8">
                  <div className="space-y-6">
                    <div>
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 block">Entity Base</span>
                      <h3 className="text-2xl font-black text-white underline decoration-blue-500/20 underline-offset-4">{companyName}</h3>
                      <p className="text-xs font-bold text-blue-500 uppercase tracking-[0.2em] mt-2 italic">{industry || 'General Industry'}</p>
                    </div>

                    <div className="pt-6 border-t border-slate-800/50">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 block">Monitoring Vectors</span>
                      <div className="flex flex-wrap gap-2">
                        {selectedTopics.map((topic: string) => (
                          <span key={topic} className="px-4 py-2 bg-slate-800 rounded-xl text-[10px] font-black text-blue-400 uppercase tracking-widest border border-blue-500/10">
                            {topic}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-10 bg-slate-950 rounded-[40px] border border-slate-800 space-y-8 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 blur-[40px] rounded-full group-hover:bg-blue-600/10 transition-colors" />
                  
                  <div className="space-y-6">
                    <div>
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 block">Deployment Summary</span>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center bg-slate-900/40 p-5 rounded-3xl border border-slate-800/50">
                          <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Active Plan</span>
                          <span className="text-xs font-black text-white uppercase tracking-widest bg-blue-600/20 px-4 py-2 rounded-xl text-blue-400 border border-blue-500/20">{selectedTier}</span>
                        </div>
                        <div className="flex justify-between items-center bg-slate-900/40 p-5 rounded-3xl border border-slate-800/50">
                          <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Signal Types</span>
                          <span className="text-xs font-black text-white uppercase tracking-widest">{selectedContentTypes.length} Active</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-6 bg-blue-600/5 rounded-3xl border border-blue-600/20">
                       <div className="flex gap-4 items-center">
                          <Shield className="w-6 h-6 text-blue-500" />
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-relaxed">
                            System will initiate full baseline scan upon final verification.
                          </p>
                       </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentStep === 7 && (
            <div className="flex flex-col items-center justify-center py-24 flex-1">
              <div className="relative mb-12">
                <div className="w-32 h-32 rounded-[40px] bg-blue-600/10 border-2 border-dashed border-blue-600/30 flex items-center justify-center animate-[spin_10s_linear_infinite]">
                  <CreditCard className="w-12 h-12 text-blue-500 -rotate-45" />
                </div>
