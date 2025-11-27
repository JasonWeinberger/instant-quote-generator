                           <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner border border-white/30">
                              <Zap size={32} className="text-white" />
                           </div>
                           <h2 className="text-2xl font-bold mb-2">Usage Limit Reached</h2>
                           <p className="text-indigo-100">
                               You've used all {MAX_FREE_QUOTES} free quotes for today.
                           </p>
                      </div>
                  </div>

                  <div className="p-8 text-center">
                      <h3 className="text-lg font-bold text-slate-900 mb-4">Upgrade for Unlimited Access</h3>
                      <ul className="text-left space-y-3 mb-8 max-w-xs mx-auto">
                          {[
                             "Unlimited AI Estimates",
                             "Save & Export History",
                             "Company Branding on Quotes"
                          ].map((feat, i) => (
                              <li key={i} className="flex items-center gap-3 text-slate-600">
                                  <Check size={16} className="text-green-500 shrink-0" />
                                  <span className="text-sm">{feat}</span>
                              </li>
                          ))}
                      </ul>
                      
                      <button 
                        onClick={handleUpgradeClick}
                        className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transition-all transform hover:-translate-y-0.5 flex items-center justify-center gap-2 mb-4"
                      >
                          Get Unlimited Access <ArrowRight size={18} />
                      </button>
                      
                      <p className="text-xs text-slate-400">
                          One-time setup. Cancel anytime.
                      </p>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default App;
