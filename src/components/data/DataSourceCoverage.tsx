import React from 'react';
import { motion } from 'framer-motion';
import { Database, Globe, CheckCircle2, Cloud, FileText, Search, Code, Key } from 'lucide-react';
import { Language } from '@/types';

interface SourceItem {
    id: string;
    name: string;
    type: 'academic' | 'industry';
    icon: React.ElementType;
    count: number;
    time: string;
    status: 'connected' | 'fetching' | 'error';
    color: string;
    bgColor: string;
}

interface DataSourceCoverageProps {
    sources?: any[]; // For future real data integration
    totalAcademic?: number;
    totalIndustry?: number;
    language?: Language;
}

const DataSourceCoverage: React.FC<DataSourceCoverageProps> = ({
    totalAcademic = 12540,
    totalIndustry = 8630,
    language = 'zh'
}) => {
    const isZh = language === 'zh';

    const academicSources: SourceItem[] = [
        { id: 'openalex', name: 'OpenAlex', type: 'academic', icon: Globe, count: 4820, time: '120ms', status: 'connected', color: 'text-blue-600', bgColor: 'bg-blue-100' },
        { id: 'arxiv', name: 'arXiv', type: 'academic', icon: FileText, count: 3150, time: '85ms', status: 'connected', color: 'text-red-600', bgColor: 'bg-red-100' },
        { id: 'crossref', name: 'Crossref', type: 'academic', icon: Key, count: 2840, time: '150ms', status: 'connected', color: 'text-indigo-600', bgColor: 'bg-indigo-100' },
        { id: 'core', name: 'CORE', type: 'academic', icon: Database, count: 1730, time: '110ms', status: 'connected', color: 'text-emerald-600', bgColor: 'bg-emerald-100' },
    ];

    const industrySources: SourceItem[] = [
        { id: 'github', name: 'GitHub', type: 'industry', icon: Code, count: 5210, time: '160ms', status: 'connected', color: 'text-slate-800', bgColor: 'bg-slate-200' },
        { id: 'brave', name: 'Brave Search', type: 'industry', icon: Search, count: 2140, time: '90ms', status: 'connected', color: 'text-orange-600', bgColor: 'bg-orange-100' },
        { id: 'serpapi', name: 'SerpAPI (Google)', type: 'industry', icon: Cloud, count: 1280, time: '210ms', status: 'connected', color: 'text-google-blue', bgColor: 'bg-blue-100' },
    ];

    const SourceCard = ({ source, delay }: { source: SourceItem, delay: number }) => (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: delay * 0.1, duration: 0.5 }}
            className="flex items-center justify-between p-3 rounded-xl border border-gray-100 bg-white hover:shadow-md transition-shadow relative overflow-hidden group"
        >
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-transparent via-current to-transparent opacity-0 group-hover:opacity-20 transition-opacity" style={{ color: source.color.replace('text-', '') }} />

            <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${source.bgColor} ${source.color}`}>
                    <source.icon size={20} />
                </div>
                <div>
                    <div className="font-bold text-gray-800 flex items-center gap-2">
                        {source.name}
                        {source.status === 'connected' && (
                            <span className="flex h-2 w-2 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                        )}
                    </div>
                    <div className="text-xs text-gray-500 flex items-center gap-1">
                        <CheckCircle2 size={12} className="text-emerald-500" />
                        <span>{isZh ? '已连接' : 'Connected'} • {source.time}</span>
                    </div>
                </div>
            </div>
            <div className="text-right">
                <div className="font-bold text-gray-900">{source.count.toLocaleString()}</div>
                <div className="text-[10px] text-gray-400 uppercase tracking-wider">{isZh ? '条记录' : 'Records'}</div>
            </div>
        </motion.div>
    );

    return (
        <div className="w-full bg-white/95 rounded-3xl p-6 md:p-8 shadow-sm border border-gray-200/60 transition-all hover:shadow-md">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                <div>
                    <h3 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
                        <span className="bg-gradient-to-r from-blue-600 to-indigo-600 text-transparent bg-clip-text">
                            {isZh ? '七源双轨数据图谱' : 'Dual-Track Data Coverage'}
                        </span>
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                        {isZh ? '首创学术与产业双维交叉验证，确保评估无盲区' : 'Pioneering academic and industry cross-validation for blind-spot-free evaluation'}
                    </p>
                </div>
                <div className="flex gap-4">
                    <div className="text-right">
                        <div className="text-2xl font-black text-blue-600">{totalAcademic.toLocaleString()}</div>
                        <div className="text-xs text-gray-500 font-medium">{isZh ? '学术文献池' : 'Academic Pool'}</div>
                    </div>
                    <div className="w-px h-10 bg-gray-200"></div>
                    <div className="text-left">
                        <div className="text-2xl font-black text-purple-600">{totalIndustry.toLocaleString()}</div>
                        <div className="text-xs text-gray-500 font-medium">{isZh ? '产业实证数据' : 'Industry Data'}</div>
                    </div>
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
                {/* Academic Sources */}
                <div className="space-y-4">
                    <h4 className="flex items-center gap-2 font-bold text-slate-700 text-sm tracking-wider uppercase bg-blue-50/50 p-2 rounded-lg border border-blue-100/50">
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                        {isZh ? '学术四源 (Academic Quads)' : 'Academic Quads'}
                    </h4>
                    <div className="grid gap-3">
                        {academicSources.map((source, idx) => (
                            <SourceCard key={source.id} source={source} delay={idx} />
                        ))}
                    </div>
                </div>

                {/* Industry Sources */}
                <div className="space-y-4">
                    <h4 className="flex items-center gap-2 font-bold text-slate-700 text-sm tracking-wider uppercase bg-purple-50/50 p-2 rounded-lg border border-purple-100/50">
                        <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                        {isZh ? '产业三源 (Industry Tri-Nodes)' : 'Industry Tri-Nodes'}
                    </h4>
                    <div className="grid gap-3">
                        {industrySources.map((source, idx) => (
                            <SourceCard key={source.id} source={source} delay={idx + 4} />
                        ))}
                    </div>
                    <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-200 flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center flex-shrink-0 text-emerald-500">
                            <CheckCircle2 size={16} />
                        </div>
                        <p className="text-xs text-gray-600 leading-relaxed">
                            {isZh
                                ? '通过组合开源代码库(GitHub)、搜索引擎(Brave)和商业API(SerpAPI)，覆盖了99%的公域和开源商业项目。'
                                : 'By combining open-source repos, search engines, and commercial APIs, we cover 99% of public and open-source projects.'}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DataSourceCoverage;
