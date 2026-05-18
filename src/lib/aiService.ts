import { GoogleGenAI } from "@google/genai";

let ai: GoogleGenAI | null = null;

function getAi() {
  if (!ai) {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || (typeof process !== 'undefined' ? process.env?.GEMINI_API_KEY : undefined);
    if (!apiKey) {
      console.error("GEMINI_API_KEY is missing. In Vercel, please ensure GEMINI_API_KEY is added to Environment Variables and you must REDEPLOY the project so the build can inject the key.");
      throw new Error("GEMINI_API_KEY is not configured.");
    }
    ai = new GoogleGenAI({ apiKey: apiKey });
  }
  return ai;
}

const SYSTEM_INSTRUCTION = `당신은 20대 대학생들을 위한 약속 조율 앱 '언제어디'의 AI 총대 봇입니다.
말투: 20대 대학생처럼 친근하고 발랄한 말투를 사용하세요. (예: "~했어?", "~하자!", "우와", ㅠㅠ, ㅋㅋ 등의 이모티콘 및 초성 가볍게 사용)
딱딱한 기계나 비서처럼 말하지 말고, 약속 방에 있는 친한 친구 중 한 명(과대표 역할)처럼 행동하세요.

[핵심 규칙]
응답을 재촉할 때는 장난스럽지만 확실하게 행동을 요구하세요.
정보를 요약할 때는 모바일 화면에서 읽기 쉽게 줄바꿈을 활용하고 핵심만 간결하게 전달하세요.`;

export async function recommendFinalPlan(totalMembers: number, availabilities: any[]) {
  const prompt = `
[일정 추합 및 최적 시간 도출, 취향 반영 장소 추천]
모든 사용자가 시간을 입력했거나 마감 기한이 끝났어. 입력된 데이터를 분석해서 가장 최적의 약속 시간과 장소를 뽑아줘.

총 인원: ${totalMembers} 명
시간 데이터:
${JSON.stringify(availabilities.map(a => ({
    userId: a.userId.substring(0,4), 
    dates: a.possibleDates, 
    times: a.possibleTimes,
    locations: a.preferredLocations
})), null, 2)}

결과는 다음과 같은 JSON 형식으로 반환해줘:
{
  "finalDate": "분석된 최적의 날짜 (가장 많이 겹치는 날)",
  "finalTime": "분석된 최적의 시간 (가장 많이 겹치는 시간)",
  "finalLocation": "분석된 가장 선호도 높은 지역 (예: 강남역)",
  "recommendationReason": "친구들에게 전하는 메세지. 분석 결과 요약, 1순위/2순위 시간 제안, 추천 장소 3곳(실제 장소 위주, 누구의 취향이 반영되었는지 포함), 그리고 마지막에 이 3곳 중 투표로 정하자는 멘트를 친근하고 발랄한 20대 대학생 말투로 작성할 것! 줄바꿈을 활용해서 읽기 쉽게 써줘."
}
`;

  try {
    const aiClient = getAi();
    const response = await aiClient.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
      }
    });
    
    if (!response.text) return null;
    const result = JSON.parse(response.text);
    return result;
  } catch (error) {
    console.error("AI Service Error:", error);
    return null;
  }
}

export async function getUrgeMessage(roomTitle: string, nonResponders: string[], deadline: string) {
  const prompt = `
[상황별 기초 지시서]
미응답자 독려 : 다음 정보를 바탕으로 아직 약속 정보를 입력하지 않은 친구를 독려하는 짧은 메시지를 작성해 줘. 푸시 알림으로 갈 거니까 2~3문장 이내로 핵심만 짧게 써줘.

약속 방 이름: ${roomTitle}
미응답자 이름: ${nonResponders.join(', ')}
마감 기한: ${deadline || '조만간'}
  `;

  try {
    const aiClient = getAi();
    const response = await aiClient.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `미응답자 독려 자동 알림이야.
약속 방에 응답하지 않은 사용자 [${nonResponders.join(', ')}]에게 보내는 독려 알림이야. [${roomTitle}]의 마감이 얼마 남지 않았음을 강조하고, 너(AI 총대) 때문에 약속이 안 잡히고 있다는 점을 귀엽게 압박해 줘. 
(예시 - "🚨 야 [이름]! 너만 적으면 끝인데 왜 안 와! ㅠㅠ [방 제목] 마감 임박! 지금 바로 입력해 줘!")

짧게 1-2문장으로 푸시 알림용으로 만들어줘.`,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
      }
    });
    return response.text;
  } catch (err) {
    console.error("AI Service Error:", err);
    return null;
  }
}
