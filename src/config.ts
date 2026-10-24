export const site = {
 name: 'Vansh',
 title: 'Vansh — Aerospace & Technology',
 description: 'Notes, projects, and experiments in aerospace, engineering, and technology.',
 // Fill these in to show contact links. Empty values hide the links.
 github: '', linkedin: '', email: '',
};
export const url = (path = '') => `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;
export const dateLabel = (date: Date) => date.toLocaleDateString('en-US', {month:'short',day:'numeric',year:'numeric',timeZone:'UTC'});
