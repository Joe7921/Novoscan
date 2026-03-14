import React from 'react';
import { InternetSource } from '@/types';
import { Code2, FileText, PlayCircle, Globe, ExternalLink } from 'lucide-react';

interface InternetSourceCardProps {
    source: InternetSource;
}

const InternetSourceCard: React.FC<InternetSourceCardProps> = ({ source }) => {
    return (
        <div className="bg-white/95 border border-slate-100 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow h-full flex flex-col">
            <div className="flex items-start gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                    {source.url.includes('github.com') ? (
                        <Code2 className="text-slate-700" />
                    ) : source.url.includes('arxiv.org') ? (
                        <FileText className="text-red-500" />
                    ) : source.url.includes('youtube.com') ? (
                        <PlayCircle className="text-red-600" />
                    ) : (
                        <Globe className="text-blue-500" />
                    )}
                </div>
                <div>
                    <h4 className="font-semibold text-slate-800 text-sm line-clamp-2" title={source.title}>{source.title}</h4>
                    <div className="text-xs text-slate-400 mt-1 truncate max-w-[200px]" title={(() => { try { return new URL(source.url).hostname; } catch (e) { return source.url; } })()}>
                        {(() => { try { return new URL(source.url).hostname; } catch (e) { return source.url; } })()}
                    </div>
                </div>
            </div>

            <p className="text-sm text-slate-600 mb-4 line-clamp-3 flex-grow">
                {source.snippet}
            </p>

            <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1 mt-auto bg-indigo-50 w-fit px-3 py-1.5 rounded-lg transition-colors hover:bg-indigo-100"
            >
                <ExternalLink className="text-[14px]" />
                Visit Source
            </a>
        </div>
    );
};

export default InternetSourceCard;
