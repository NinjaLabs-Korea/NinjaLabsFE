// Application questions for the layout flows (13, 14): one question of every type, with long wording, so the form and the editor
// are measured with the widest realistic content. Flow 12 configures its own questions through the UI.
import { apiAs } from './harness.mjs';

export const ALL_TYPE_QUESTIONS = [
  { type: 'SHORT_TEXT', required: true, label: { ko: 'GitHub 주소 또는 포트폴리오 링크 (긴 질문 문구도 줄바꿈이 잘 되는지 확인합니다)', en: 'GitHub or portfolio link' }, help: { ko: '없으면 지금까지 만든 것을 가장 잘 보여 주는 링크를 적어 주세요.' } },
  { type: 'LONG_TEXT', required: false, label: { ko: '지금까지 해 온 일을 자유롭게 적어 주세요' }, help: { ko: '프로젝트, 글, 행사 운영 등 무엇이든 좋아요.' } },
  { type: 'SINGLE_CHOICE', required: true, label: { ko: '닌자랩스에서 가장 기대하는 활동', en: 'The activity you look forward to most' },
    options: [{ label: { ko: '바운티 참여', en: 'Bounties' } }, { label: { ko: '커뮤니티 운영', en: 'Community' } }, { label: { ko: '기타 (직접 적기)', en: 'Other' }, withDetail: true }] },
  { type: 'MULTI_CHOICE', required: true, label: { ko: '참여하고 싶은 분야 (여러 개 선택)', en: 'Areas you want to join' },
    options: ['개발자', '콘텐츠 크리에이터', 'KOL(인플루언서)', '커뮤니티·마케팅', '리서처', '사업개발', '디자이너 겸 프로덕트 기획자와 같이 이름이 아주 긴 선택지'].map((ko) => ({ label: { ko } }))
      .concat([{ label: { ko: '기타', en: 'Other' }, withDetail: true }]) },
];

/** Replaces the cohort's questions with `ALL_TYPE_QUESTIONS` (all new ids) and returns the stored questions. */
export async function configureAllTypeQuestions(adminToken, cohortId) {
  const [status, body] = await apiAs(adminToken, 'PUT', `/admin/cohorts/${cohortId}/questions`, { questions: ALL_TYPE_QUESTIONS });
  if (status >= 300) throw new Error(`PUT questions failed: ${status} ${body}`);
  return JSON.parse(body).questions;
}

/** A valid `answers` array for `questions` (every required question, plus the long text), used to create applications through the API. */
export function answersFor(questions) {
  return questions.flatMap((question) => {
    if (question.type === 'SHORT_TEXT') return [{ questionId: question.id, text: 'https://github.com/ninja-labs-korea' }];
    if (question.type === 'LONG_TEXT') return [{ questionId: question.id, text: 'Injective 위에서 대시보드를 만들고 커뮤니티를 도와 왔습니다.\n두 번째 줄입니다.' }];
    const detail = question.options.find((option) => option.withDetail);
    const picks = question.type === 'SINGLE_CHOICE' ? [question.options[0]] : [question.options[0], question.options[2], detail].filter(Boolean);
    return [{ questionId: question.id, choices: picks.map((option) => option.id), ...(picks.some((option) => option.withDetail) ? { other: '온체인 데이터 시각화' } : {}) }];
  });
}
