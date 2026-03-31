import React from 'react';

interface LiabilityWaiverProps {
  organizationName?: string;
}

export const LiabilityWaiver: React.FC<LiabilityWaiverProps> = ({ organizationName }) => {
  const orgLabel = organizationName || 'the tournament organizer';

  return (
    <div className="bg-brand-50 border-2 border-brand-800 rounded-lg p-6">
      <h3 className="text-xl font-bold text-brand-800 mb-4 uppercase text-center">
        Liability Waiver
      </h3>
      <div className="text-sm text-gray-700 space-y-3">
        <p className="font-semibold text-center">
          ALL PLAYERS MUST SIGN LIABILITY WAIVER TO PLAY.
        </p>
        <p>
          <span className="font-semibold">WAIVER:</span> I understand that
          participating in this event is a potentially hazardous activity,
          therefore, I assume all risks associated with my participation
          including, but not limited to, falls, contact with other participants,
          traffic, effects of the weather and conditions of the venue. By
          signing this form for myself and those on whose behalf I have
          registered, I waive and release {orgLabel} and its officers,
          employees, agents, event planners/coordinators,
          contributors and sponsors from any and all claims or liabilities that
          may arise from my participation in this event. I understand that I
          should not enter this event unless I am medically able. I agree to
          abide with all the rules of this event and abide by the decisions made
          by the officials, including those that relate to my ability to safely
          complete the event. Lastly, I grant permission to use my photo, video
          or any other record of this event for public relations purposes.
        </p>
      </div>
    </div>
  );
};
