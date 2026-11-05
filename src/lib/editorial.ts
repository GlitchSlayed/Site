export const readingMinutes = (body = '') => Math.max(1, Math.ceil(body.replace(/```[\s\S]*?```/g, '').split(/\s+/).filter(Boolean).length / 220));
export const statusNotes: Record<string, string> = {
  Concept: 'A question and a proposed approach. Results are still to come.',
  'In Development': 'Work is underway. The write-up separates what exists from what is planned.',
  Prototype: 'An early implementation. See the project notes for checks and remaining limits.',
  Completed: 'The documented scope is complete. Methods and limitations remain part of the record.',
};
