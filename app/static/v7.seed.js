const V7_SEED_DATA = {
  surveys: [
    { id: 1, name: 'Brand Perception Study', tenantGroupName: 'Hartwell & Sons' },
    { id: 2, name: 'Customer Exit Survey', tenantGroupName: 'Hartwell & Sons' },
    { id: 3, name: 'UX Feedback', tenantGroupName: 'Meridian Research Group' },
    { id: 4, name: 'Employee Pulse Q2', tenantGroupName: 'Meridian Research Group' },
    { id: 5, name: 'Market Positioning Study', tenantGroupName: 'Meridian Research Group' },
    { id: 6, name: 'Creative Direction Survey', tenantGroupName: 'Foxglove Studio' },
  ],
  deployed: [
    { name: 'Brand Perception Study', tenantGroupName: 'Hartwell & Sons', deployedAt: '2026-05-02T09:00:00Z', closed: true, invited: 120, submitted: 98, tracked: true },
    { name: 'Brand Perception Study', tenantGroupName: 'Hartwell & Sons', deployedAt: '2026-05-06T13:15:00Z', closed: false, invited: 42, submitted: 7, tracked: true },
    {
      name: 'Customer Exit Survey',
      tenantGroupName: 'Hartwell & Sons',
      deployedAt: '2026-05-04T14:30:00Z',
      closed: false,
      invited: 5,
      submitted: 21,
      tracked: true,
      invites: [
        { email: 'alice@example.com', link: 'https://surveys.app/s/xdcf530k', otp: '247JH', status: 'Sent' },
        { email: 'bob@example.com', link: 'https://surveys.app/s/vigtvv7k', otp: 'L7I5J', status: 'Sent' },
        { email: 'carol@example.com', link: 'https://surveys.app/s/u5dt9f3s', otp: 'HJ7OW', status: 'Sent' },
        { email: 'david@example.com', link: 'https://surveys.app/s/4ywq0uvy', otp: '9466I', status: 'Sent' },
        { email: 'eve@example.com', link: 'https://surveys.app/s/bcgjwauj', otp: '7P4S4', status: 'Sent' },
      ],
    },
    { name: 'UX Feedback', tenantGroupName: 'Meridian Research Group', deployedAt: '2026-05-01T11:00:00Z', closed: true, invited: 200, submitted: 183, tracked: true },
    { name: 'Employee Pulse Q2', tenantGroupName: 'Meridian Research Group', deployedAt: '2026-05-05T08:00:00Z', closed: false, invited: 85, submitted: 40, tracked: true },
    { name: 'Creative Direction Survey', tenantGroupName: 'Foxglove Studio', deployedAt: '2026-05-03T10:00:00Z', closed: false, invited: 30, submitted: 12, tracked: false },
  ],
};
