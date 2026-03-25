def fix_botched():
    # Read the botched portion from lines 860 to 1080
    with open('botched.tsx', 'r', encoding='utf-8') as f:
        text = f.read()

    # The step 6 prefix we successfully wrote earlier
    new_step_6 = """          {currentStep === 6 && (
            <div className="space-y-10 flex-1">
              <div className="max-w-xl text-left">
                <h2 className="text-4xl font-black text-white tracking-tight leading-none mb-4 uppercase italic underline decoration-blue-500/20 underline-offset-8">Review <span className="text-blue-500">Your Setup</span></h2>
                <p className="text-slate-400 font-bold leading-relaxed pr-8">
                  Review your business profile and monitoring settings before we start your baseline intelligence sweep.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10 text-left w-full h-[500px]">
                {/* Scrollable Configuration Column */}
                <div className="bg-slate-900/40 rounded-[32px] border border-slate-800/50 p-6 flex flex-col shadow-inner h-full">
                  <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6 flex-shrink-0">Configuration Values</h3>
                  <div className="flex-1 overflow-y-auto pr-2 space-y-8 custom-scrollbar">
                    
                    {/* Business Profile */}
                    <div className="space-y-3">
                       <span className="text-[9px] font-black text-blue-500 uppercase tracking-[0.2em] block mb-2">Target Profile</span>
                       <div className="flex justify-between items-center p-3 rounded-xl bg-slate-950/50 border border-slate-800">
                          <span className="text-[10px] font-bold text-slate-500 uppercase">Entity</span>
                          <span className="text-xs font-black text-white">{companyName || 'Not Set'}</span>
                       </div>
                       <div className="flex justify-between items-center p-3 rounded-xl bg-slate-950/50 border border-slate-800">
                          <span className="text-[10px] font-bold text-slate-500 uppercase">Vector</span>
                          <span className="text-xs font-black text-white">{industry || 'Not Set'}</span>
                       </div>
                    </div>

                    {/* Monitored Topics */}
                    <div>
                      <div className="flex justify-between flex-end mb-2">
                        <span className="text-[9px] font-black text-blue-500 uppercase tracking-[0.2em]">Signal Filters</span>
                        <span className="text-[9px] font-black text-slate-600 bg-slate-950 px-2 py-0.5 rounded tracking-widest">{selectedTopics.length} Active</span>
                      </div>
                      <div className="flex flex-wrap gap-2 p-3 rounded-xl bg-slate-950/50 border border-slate-800">
                        {selectedTopics.length > 0 ? selectedTopics.map((topic) => (
                          <span key={topic} className="px-2 py-1 bg-slate-800/50 text-white border border-slate-700 rounded text-[9px] font-bold uppercase tracking-tight">
                            {topic}
                          </span>
                        )) : <span className="text-xs text-slate-600 italic">No topics selected</span>}
                      </div>
                    </div>

                    {/* Content Types */}
                    <div>
                      <span className="text-[9px] font-black text-blue-500 uppercase tracking-[0.2em] block mb-2">Source Integrity</span>
                      <div className="flex flex-wrap gap-2 p-3 rounded-xl bg-slate-950/50 border border-slate-800">
                        {selectedContentTypes.length > 0 ? selectedContentTypes.map((typeId) => {
                          const type = CONTENT_TYPES.find((t) => t.id === typeId);
                          return (
                            <span key={typeId} className="px-2 py-1 bg-blue-600/10 text-blue-400 border border-blue-500/20 rounded flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest">
                              {type && <type.icon className="w-3 h-3" />}
                              {type?.label}
                            </span>
                          );
                        }) : <span className="text-xs text-slate-600 italic">No sources selected</span>}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Fixed Plan Overview Column */}
                <div className="bg-slate-950 rounded-[40px] p-8 flex flex-col justify-between shadow-2xl relative overflow-hidden group border border-slate-800 h-full">
                  <div className="absolute top-0 right-0 w-[80%] h-[80%] bg-blue-500/5 blur-[80px] rounded-full pointer-events-none transition-transform duration-1000 group-hover:scale-110" />
                  
                  <div className="relative z-10 flex-shrink-0">
                    <div className="inline-flex items-center gap-2 mb-8">
                       <div className="w-2 h-2 rounded bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)] animate-pulse" />
                       <span className="text-[9px] font-black text-blue-400 uppercase tracking-[0.3em]">Network Node Status</span>
                    </div>
                    
                    <h3 className="text-4xl font-black text-white tracking-tight mb-2 uppercase italic">{getTierConfig(selectedTier).name} <span className="text-blue-500">Tier</span></h3>
                    <p className="text-sm font-bold text-slate-400 tracking-tight leading-relaxed mb-6">Fully operational {getTierConfig(selectedTier).features[0].toLowerCase()} optimized for advanced analytics.</p>
                    
                    <div className="space-y-4">
                      {getTierConfig(selectedTier).features.slice(1, 4).map((feature, idx) => (
                        <div key={idx} className="flex items-center gap-3">
                          <div className="w-5 h-5 rounded border border-slate-800 bg-slate-900 flex items-center justify-center flex-shrink-0">
                            <Check className="w-3 h-3 text-blue-500" strokeWidth={4} />
                          </div>
                          <span className="text-xs font-bold text-slate-300 tracking-tight leading-tight">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Summary Bar */}
                  <div className="relative z-10 mt-auto pt-6 border-t border-slate-800/50 flex-shrink-0">
                     <div className="flex justify-between items-end">
                        <div>
                           <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Power Allocation</span>
                           <div className="text-sm font-black text-blue-400 flex items-center gap-2">
                             <Zap className="w-4 h-4" />
                             {getTierConfig(selectedTier).monthlyCredits} CPU / MO
                           </div>
                        </div>
                        <div className="text-right">
                           <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Network Access</span>
                           <div className="flex items-baseline gap-1">
                             <span className="text-4xl font-black text-white tracking-tighter leading-none">${pricing.monthly.toFixed(0)}</span>
                             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">/ Mo</span>
                           </div>
                        </div>
                     </div>
                  </div>
                </div>
              </div>
            </div>
          )}
"""
    
    # We will use replace_file_content to swap out lines 915 to 1073 directly with our valid Step 6 block!
    with open('step_6_fix.tsx', 'w', encoding='utf-8') as f:
        f.write(new_step_6)

fix_botched()
