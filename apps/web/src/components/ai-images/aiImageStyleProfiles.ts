import type { AIImageStyleProfile } from '@/api/aiImages';

export const groupAIImageStyleProfiles = (
  profiles: AIImageStyleProfile[],
  query: string,
): Record<AIImageStyleProfile['source'], AIImageStyleProfile[]> => {
  const keyword = query.trim().toLocaleLowerCase();
  const visibleProfiles = profiles.filter(
    (profile) =>
      !keyword || `${profile.name} ${profile.description}`.toLocaleLowerCase().includes(keyword),
  );
  return {
    builtin: visibleProfiles.filter((profile) => profile.source === 'builtin'),
    skill: visibleProfiles.filter((profile) => profile.source === 'skill'),
  };
};
