import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { Copy, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import type { DashboardProfile } from './DashboardLayout';

const SiteUrlPage = () => {
  const { profile } = useOutletContext<{ profile: DashboardProfile }>();
  const siteUrl = `${window.location.origin}/${profile.username}`;
  return (
    <div className="blox-card p-6">
      <h2 className="text-lg font-semibold mb-2">Your site URL</h2>
      <p className="text-gray-400 text-sm mb-3">Share this link to use your version of the site.</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 bg-black/40 border border-white/10 rounded-md p-3 text-primary break-all">{siteUrl}</code>
        <button
          onClick={() => {
            navigator.clipboard.writeText(siteUrl);
            toast.success('Copied!');
          }}
          className="p-3 bg-primary/20 hover:bg-primary/30 rounded-md transition-all"
          aria-label="Copy URL"
          title="Copy URL"
        >
          <Copy size={18} />
        </button>
        <a
          href={siteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="p-3 bg-primary/20 hover:bg-primary/30 rounded-md transition-all inline-flex items-center"
          aria-label="Open in new tab"
          title="Open in new tab"
        >
          <ExternalLink size={18} />
        </a>
      </div>
    </div>
  );
};

export default SiteUrlPage;
