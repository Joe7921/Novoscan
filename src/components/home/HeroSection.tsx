import React from 'react';
import { Language, ModelProvider, MODEL_OPTIONS, ScanMode } from '@/types';
import { translations } from '../../locales/translations';
import InnovationAutocomplete from '../innovation/InnovationAutocomplete';
import DomainSelector from './DomainSelector';
import FlashModeToggle from './FlashModeToggle';
import { Search, Bot, AlertCircle, Sparkles, Wand2 } from 'lucide-react';
import PrivacyToggle from '@/components/ui/PrivacyToggle';
// 性能优化：使用 CSS 动画替代 framer-motion，减小 bundle 体积
import AntigravityCard from '@/components/antigravity/AntigravityCard';
import AntigravityButton from '@/components/antigravity/AntigravityButton';

interface HeroSectionProps {
    idea: string;
    setIdea: (idea: string) => void;
    handleAnalyze: () => void;
    error: string | null;
    language: Language;
    selectedModel: ModelProvider;
    setSelectedModel: (model: ModelProvider) => void;
    selectedDomainId: string | null;
    onDomainChange: (domainId: string | null) => void;
    selectedSubDomainId: string | null;
    onSubDomainChange: (subDomainId: string | null) => void;
    isPrivateMode: boolean;
    onPrivacyToggle: () => void;
    scanMode: ScanMode;
    onScanModeChange: (mode: ScanMode) => void;
}
import { ProjectIcon } from '../icons/ProjectIcon';

const HeroSection: React.FC<HeroSectionProps> = ({
    idea,
    setIdea,
    handleAnalyze,
    error,
    language,
    selectedModel,
    setSelectedModel,
    selectedDomainId,
    onDomainChange,
    selectedSubDomainId,
    onSubDomainChange,
    isPrivateMode,
    onPrivacyToggle,
    scanMode,
    onScanModeChange,
}) => {
    const t = translations[language];
    const isZh = language === 'zh';

    // #1 快速体验示例
    const quickExamples = isZh
        ? ['AI 生成式药物研发', '具身智能家庭机器人', '脑机接口消费级应用', '碳捕获 + 区块链碳交易']
        : ['AI-driven drug discovery', 'Embodied home robot', 'Consumer BCI device', 'Carbon capture + blockchain'];

    return (
        <div
            className="w-full max-w-[1440px] mx-auto mt-2 sm:mt-4 md:mt-12 lg:mt-16 xl:px-10 px-4 sm:px-6 relative z-10 animate-fade-in-up"
        >
            <div className="text-center mb-10 sm:mb-16 lg:mb-12">
                <div
                    className="inline-flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-google-blue/10 border border-google-blue/20 dark:border-blue-500/30 text-google-blue dark:text-blue-400 text-xs sm:text-sm font-bold mb-6 sm:mb-8 lg:mb-12 mx-auto animate-scale-in"
                    style={{ animationDelay: '0.2s' }}
                >
                    <ProjectIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span className="whitespace-nowrap">NovoScan Engine Active</span>
                </div>

                <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl xl:text-8xl font-black tracking-tighter text-center uppercase leading-[1.2] sm:leading-[1.1] text-gray-900 dark:text-white mb-6 sm:mb-8 overflow-visible relative">
                    {/* 暗色光晕背景 */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-full bg-blue-500/20 blur-[100px] -z-10 hidden dark:block opacity-0 animate-fade-in" style={{ animationDelay: '0.8s' }} />
                    {t.titleStart}<span className="text-google-blue dark:text-blue-400 drop-shadow-sm dark:drop-shadow-[0_0_15px_rgba(96,165,250,0.5)]">{t.titleEnd}</span>
                </h1>

                <p className="text-base sm:text-xl md:text-2xl text-gray-500 dark:text-slate-400 max-w-[1440px] mx-auto font-medium tracking-tight px-4 sm:px-0">
                    {t.subtitle}
                </p>
            </div>

            <AntigravityCard
                glassmorphism={true}
                className="p-3 sm:p-4 md:p-6 relative z-20 group transition-all duration-500
                    !bg-white/30 hover:!bg-white/95 dark:!bg-dark-surface/60 dark:hover:!bg-dark-surface/80
                    border !border-white/60 dark:!border-slate-700/50 
                    !shadow-[0_8px_32px_0_rgba(31,38,135,0.15)] dark:!shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] 
                    ring-1 ring-white/40 dark:ring-slate-700/30
                    focus-within:!bg-white/95 focus-within:ring-white/80 focus-within:!shadow-[0_16px_48px_0_rgba(31,38,135,0.2)]
                    dark:focus-within:!bg-dark-elevated/80 dark:focus-within:ring-slate-600/50 dark:focus-within:!shadow-[0_16px_48px_0_rgba(0,0,0,0.5)]
                    dark:focus-within:border-slate-500/50"
                hoverEffect={true}
            >
                <div className="relative w-full">
                    <div className="pb-28 sm:pb-24 lg:pb-16">
                        <InnovationAutocomplete
                            value={idea}
                            onChange={setIdea}
                            onSubmit={handleAnalyze}
                            placeholder={t.placeholder}
                            language={language}
                        />
                    </div>

                    <div className="absolute bottom-3 sm:bottom-4 left-3 right-3 sm:left-auto sm:right-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 z-30">
                        <div className="flex items-center justify-between sm:justify-start gap-2 sm:gap-3">
                            <FlashModeToggle scanMode={scanMode} onModeChange={onScanModeChange} language={language} />
                            <PrivacyToggle isPrivate={isPrivateMode} onToggle={onPrivacyToggle} />
                            <div className="text-xs text-gray-400 dark:text-slate-500 hidden lg:block tracking-widest uppercase font-bold whitespace-nowrap">
                                {t.poweredBy}
                            </div>
                        </div>
                        <AntigravityButton
                            onClick={handleAnalyze}
                            disabled={!idea.trim()}
                            variant="primary"
                            size="md"
                            icon={<Search className={`w-5 h-5 ${idea.trim() ? 'animate-pulse' : ''}`} />}
                            className={`w-full sm:w-auto shadow-2xl py-3 sm:py-2.5 text-base sm:text-sm whitespace-nowrap transition-all duration-500 
                                ${idea.trim() 
                                    ? 'shadow-blue-300/50 dark:shadow-blue-500/20 ring-2 ring-blue-400/30 dark:ring-blue-500/30' 
                                    : 'shadow-gray-200/50 dark:shadow-none'}`}
                            onMouseEnter={() => {
                                // 悬停时预加载分析相关 chunk，消除点击后白屏
                                import('@/components/thinking/ThinkingIndicator').catch(() => { });
                                import('@/components/analysis').catch(() => { });
                            }}
                            onTouchStart={() => {
                                // 移动端触摸时预加载
                                import('@/components/thinking/ThinkingIndicator').catch(() => { });
                                import('@/components/analysis').catch(() => { });
                            }}
                        >
                            {t.checkButton}
                        </AntigravityButton>
                        {/* 点数消耗标签 */}
                        <span className="text-[11px] font-bold text-gray-400 dark:text-slate-400 whitespace-nowrap hidden sm:inline-flex items-center gap-1 bg-gray-50 dark:bg-dark-surface px-2 py-1 rounded-full border border-gray-100 dark:border-slate-700">
                            {scanMode === 'flash' ? '⚡' : '💰'} {scanMode === 'flash' ? '6' : '15'} {isZh ? '点' : 'pts'}
                        </span>
                    </div>
                </div>
            </AntigravityCard>

            {/* #1 快速体验示例标签 */}
            {!idea.trim() && (
                <div
                    className="mt-4 sm:mt-6 flex flex-wrap items-center justify-center gap-2 animate-fade-in-up"
                    style={{ animationDelay: '0.6s' }}
                >
                    <span className="text-xs text-gray-400 dark:text-slate-500 font-bold flex items-center gap-1 mr-1">
                        <Wand2 className="w-3.5 h-3.5" />
                        {isZh ? '快速体验' : 'Quick try'}
                    </span>
                    {quickExamples.map((example) => (
                        <button
                            key={example}
                            onClick={() => setIdea(example)}
                            className="px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-slate-400 bg-white/95 dark:bg-dark-surface/60 hover:bg-white/95 dark:hover:bg-dark-elevated hover:text-gray-800 dark:hover:text-slate-200 border border-gray-200/60 dark:border-slate-700/60 hover:border-gray-300 dark:hover:border-slate-600 rounded-full transition-all duration-300 hover:shadow-sm dark:hover:shadow-none cursor-pointer"
                        >
                            {example}
                        </button>
                    ))}
                </div>
            )}

            {/* 学科聚焦选择器 */}
            <DomainSelector
                language={language}
                selectedDomainId={selectedDomainId}
                onDomainChange={onDomainChange}
                selectedSubDomainId={selectedSubDomainId}
                onSubDomainChange={onSubDomainChange}
            />

            {/* 模型选择器 */}
            <div
                className="mt-8 sm:mt-12 lg:mt-20 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 w-full animate-fade-in"
                style={{ animationDelay: '0.5s' }}
            >
                <span className="text-xs sm:text-sm text-gray-500 dark:text-slate-400 font-bold flex items-center justify-center gap-1.5 sm:gap-2 bg-gray-50 dark:bg-dark-surface px-3 py-1.5 sm:px-4 sm:py-2 rounded-full border border-gray-200 dark:border-slate-700 w-auto">
                    <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-gray-900 dark:text-slate-200" />
                    {isZh ? '模型选择' : 'Model'}
                </span>
                <div className="flex bg-gray-100 dark:bg-dark-surface p-1.5 sm:p-1.5 rounded-[2rem] border border-gray-200 dark:border-slate-700 overflow-x-auto w-full sm:w-auto max-w-full scrollbar-hide snap-x touch-pan-x" style={{ WebkitOverflowScrolling: 'touch' }}>
                    {MODEL_OPTIONS.map((option) => (
                        <button
                            key={option.id}
                            onClick={() => setSelectedModel(option.id)}
                            className={`px-5 py-2.5 sm:px-6 sm:py-3 rounded-full text-xs sm:text-sm font-bold whitespace-nowrap flex-shrink-0 transition-all duration-300 flex items-center gap-2 relative overflow-hidden snap-center ${selectedModel === option.id
                                ? 'text-gray-900 dark:text-slate-100 shadow-md bg-white/95 sm:bg-white/95 dark:bg-dark-elevated/90 border border-white/60 dark:border-slate-600'
                                : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200 hover:bg-white/95 dark:hover:bg-dark-elevated/50'
                                }`}
                            title={option.description[language]}
                        >
                            <span className="relative z-10 flex items-center gap-2">
                                {selectedModel === option.id && (
                                    <span className="w-2.5 h-2.5 rounded-full bg-google-green dark:bg-emerald-400 shadow-[0_0_8px_rgba(52,168,83,0.5)] dark:shadow-[0_0_8px_rgba(52,211,153,0.5)]" aria-hidden="true" />
                                )}
                                <span>{option.name}</span>
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {error && (
                <div
                    className="mt-8 p-4 bg-google-red/10 dark:bg-rose-500/10 text-google-red dark:text-rose-400 rounded-3xl border border-google-red/20 dark:border-rose-500/20 flex items-center justify-center gap-3 font-bold mx-4 sm:mx-0 animate-fade-in-up"
                >
                    <AlertCircle className="w-6 h-6 flex-shrink-0" />
                    {error}
                </div>
            )}
        </div>
    );
};

export default React.memo(HeroSection);
