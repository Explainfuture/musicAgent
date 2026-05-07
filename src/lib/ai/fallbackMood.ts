import type { MoodProfile } from "@/types/agent";

const moodKeywordMap = {
  coding: ["lofi", "instrumental", "focus", "calm"],
  tired: ["soft", "calm", "mellow", "gentle"],
  sad_not_too_sad: ["warm", "healing", "gentle", "hopeful"],
  focus: ["ambient", "minimal", "study", "concentration"],
  calm: ["peaceful", "acoustic", "chill", "warm"],
};

export function fallbackParseMood(text: string): MoodProfile {
  const lowerText = text.toLowerCase();
  const isCoding = /代码|编程|coding|code|写程序/.test(lowerText);
  const isTired = /累|疲惫|困|tired|熬夜/.test(lowerText);
  const isSad = /失落|难过|emo|丧|sad|低落/.test(lowerText);
  const wantsCalm = /缓|安静|冷静|舒服|温柔|calm|gentle/.test(lowerText);
  const avoid = [
    /吵|炸|太燃|重|loud|heavy/.test(lowerText) ? "too_loud" : "",
    /不想.*丧|别.*丧|太丧|sad/.test(lowerText) ? "too_sad" : "",
  ].filter(Boolean);

  const keywords = new Set<string>();
  if (isCoding) moodKeywordMap.coding.forEach((keyword) => keywords.add(keyword));
  if (isTired) moodKeywordMap.tired.forEach((keyword) => keywords.add(keyword));
  if (isSad) moodKeywordMap.sad_not_too_sad.forEach((keyword) => keywords.add(keyword));
  if (wantsCalm) moodKeywordMap.calm.forEach((keyword) => keywords.add(keyword));
  if (keywords.size === 0) moodKeywordMap.calm.forEach((keyword) => keywords.add(keyword));

  const mood = [
    isCoding ? "focused" : "",
    isTired ? "tired" : "",
    isSad ? "slightly_down" : "",
    wantsCalm ? "needs_calm" : "",
  ].filter(Boolean);

  return {
    scene: isCoding ? "coding" : wantsCalm ? "resting" : "daily",
    mood: mood.length > 0 ? mood : ["neutral"],
    energy: isTired || wantsCalm ? "low" : "medium",
    valence: isSad ? "warm" : "neutral",
    avoid,
    keywords: Array.from(keywords).slice(0, 8),
    searchGenre: isCoding ? "lofi 器乐" : wantsCalm ? "轻音乐 钢琴" : "华语流行",
    searchLanguage: "zh-CN",
    bpmHint: isTired || wantsCalm ? "60-90" : "80-120",
    summary: isCoding
      ? "用户正在写代码，需要低干扰、稳定、不过分刺激的音乐。"
      : "用户需要一首温和、低打扰、能接住当前状态的音乐。",
  };
}
