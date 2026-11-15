import { Conversation, UserProfile } from '../types/chat';

function normalizeText(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

const STOP_WORDS = new Set([
  'a', 'o', 'as', 'os', 'um', 'uma', 'de', 'da', 'do', 'das', 'dos', 'em', 'na', 'no',
  'nas', 'nos', 'por', 'para', 'pra', 'pro', 'com', 'sem', 'que', 'qual', 'quais', 'quem',
  'onde', 'como', 'quando', 'porque', 'porquê', 'sobre', 'entre', 'isso', 'isto', 'aquilo',
  'meu', 'minha', 'seu', 'sua', 'voce', 'você', 'vc', 'ele', 'ela', 'eu', 'nós', 'sim',
  'nao', 'não', 'mais', 'menos', 'muito', 'muita', 'esta', 'está', 'estou', 'tá', 'ta',
  'fale', 'diga', 'me', 'te', 'se', 'ao', 'aos', 'pelo', 'pela', 'foi', 'era', 'ser',
  'ter', 'tem', 'tinha', 'fazer', 'fez', 'lembra', 'lembrar', 'antiga', 'conversa',
  'aqui', 'ali', 'lá', 'hoje', 'agora', 'amanha', 'ontem', 'tudo', 'bem', 'bom', 'boa',
  'dia', 'tarde', 'noite', 'pode', 'quero', 'gosto', 'falar', 'usar', 'coisa', 'coisas',
]);

// Known informal Brazilian Portuguese slang & colloquial expressions (normalized key -> canonical form)
const SLANG_LEXICON: Record<string, string> = {
  'mano': 'mano',
  'vei': 'véi',
  'vey': 'véi',
  'cara': 'cara',
  'parca': 'parça',
  'cria': 'cria',
  'brabo': 'brabo',
  'braba': 'braba',
  'zika': 'zika',
  'daora': 'daora',
  'da hora': 'da hora',
  'massa': 'massa',
  'top': 'top',
  'show': 'show',
  'firmeza': 'firmeza',
  'suave': 'suave',
  'de boa': 'de boa',
  'sussa': 'sussa',
  'partiu': 'partiu',
  'bora': 'bora',
  'fechou': 'fechou',
  'demoro': 'demorô',
  'tmj': 'tmj',
  'tamo junto': 'tamo junto',
  'vlw': 'vlw',
  'flw': 'flw',
  'blz': 'blz',
  'pprt': 'pprt',
  'papo reto': 'papo reto',
  'tlgd': 'tlgd',
  'ta ligado': 'tá ligado',
  'slk': 'slk',
  'seloko': 'seloko',
  'mds': 'mds',
  'vish': 'vish',
  'vixe': 'vixe',
  'caraca': 'caraca',
  'eita': 'eita',
  'oxe': 'oxe',
  'oxente': 'oxente',
  'uai': 'uai',
  'bah': 'bah',
  'tche': 'tchê',
  'guri': 'guri',
  'guria': 'guria',
  'role': 'rolê',
  'trampo': 'trampo',
  'corre': 'corre',
  'hype': 'hype',
  'vibe': 'vibe',
  'tankar': 'tankar',
  'intankavel': 'intankável',
  'cringe': 'cringe',
  'bagulho': 'bagulho',
  'parada': 'parada',
  'sinistro': 'sinistro',
  'bizarro': 'bizarro',
  'mitou': 'mitou',
  'amassou': 'amassou',
  'mandou bem': 'mandou bem',
  'e nois': 'é nois',
  'nois': 'nois',
  'bro': 'bro',
  'migo': 'migo',
  'miga': 'miga',
  'meu rei': 'meu rei',
  'meu consagrado': 'meu consagrado',
  'campeao': 'campeão',
  'coe': 'coé',
  'qual foi': 'qual foi',
  'fala tu': 'fala tu',
  'fala comigo': 'fala comigo',
  'bicho': 'bicho',
  'irmao': 'irmão',
  'maluco': 'maluco',
  'insano': 'insano',
  'monstro': 'monstro',
  'fera': 'fera',
  'mestre': 'mestre',
  'chave': 'chave',
  'chavoso': 'chavoso',
  'bolado': 'bolado',
  'pistola': 'pistola',
  'tiltado': 'tiltado',
  'flopou': 'flopou',
  'hitou': 'hitou',
  'brutal': 'brutal',
  'tranquilo': 'tranquilo',
  'po': 'pô',
  'nossa': 'nossa',
  'valeu': 'valeu',
  'salve': 'salve',
  'eae': 'eae',
  'opa': 'opa',
  'pdc': 'pdc',
  'pode cre': 'pode crê',
  'fala ai': 'fala aí',
  'beleza': 'beleza',
  'bota fe': 'bota fé',
  'boto fe': 'boto fé',
  'sinistrao': 'sinistrão',
};

const MULTI_WORD_SLANGS = Object.keys(SLANG_LEXICON).filter((k) => k.includes(' '));

function extractKeywords(text: string): string[] {
  const tokens = normalizeText(text)
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
  return Array.from(new Set(tokens));
}

function learnUserSlang(
  text: string,
  prevTerms: string[] = [],
  prevCounts: Record<string, number> = {}
): { slangTerms: string[]; slangCounts: Record<string, number>; changed: boolean } {
  const norm = normalizeText(text)
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!norm) {
    return { slangTerms: prevTerms, slangCounts: prevCounts, changed: false };
  }

  const nextCounts: Record<string, number> = { ...prevCounts };
  const matchedExplicit = new Set<string>();

  for (const phrase of MULTI_WORD_SLANGS) {
    const regex = new RegExp(`\\b${phrase.replace(/\s+/g, '\\s+')}\\b`, 'i');
    if (regex.test(norm)) {
      const canonical = SLANG_LEXICON[phrase];
      nextCounts[canonical] = (nextCounts[canonical] || 0) + 2;
      matchedExplicit.add(canonical);
    }
  }

  const words = norm.split(' ').filter((w) => w.length >= 2 && !STOP_WORDS.has(w));
  const seenInMsg = new Set<string>();
  for (const w of words) {
    if (seenInMsg.has(w)) continue;
    seenInMsg.add(w);
    const canonical = SLANG_LEXICON[w];
    if (canonical) {
      nextCounts[canonical] = (nextCounts[canonical] || 0) + 2;
      matchedExplicit.add(canonical);
    } else if (
      w.length >= 3 &&
      w.length <= 16 &&
      !/^\d+$/.test(w) &&
      !/^(como|onde|quando|porque|sobre|qual|quais|quem|nexus|google|brasil|mundo)$/.test(w)
    ) {
      // Track casual single-word candidates gently; they only enter slangTerms if used repeatedly (>= 3 times across messages)
      nextCounts[w] = (nextCounts[w] || 0) + 1;
    }
  }

  // Cap dictionary size to keep profile compact
  const sortedEntries = Object.entries(nextCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 60);
  const prunedCounts = Object.fromEntries(sortedEntries);

  const promoted = sortedEntries
    .filter(([term, count]) => Boolean(SLANG_LEXICON[normalizeText(term)]) || count >= 3)
    .map(([term]) => term)
    .slice(0, 25);

  const mergedTerms: string[] = [];
  const seenMerged = new Set<string>();
  for (const item of [...promoted, ...prevTerms]) {
    const key = normalizeText(item);
    if (item && !seenMerged.has(key)) {
      seenMerged.add(key);
      mergedTerms.push(item);
    }
    if (mergedTerms.length >= 25) break;
  }

  const changed =
    matchedExplicit.size > 0 ||
    mergedTerms.length !== prevTerms.length ||
    mergedTerms.some((t, i) => prevTerms[i] !== t) ||
    Object.keys(prunedCounts).length !== Object.keys(prevCounts).length;

  return { slangTerms: mergedTerms, slangCounts: prunedCounts, changed };
}

/**
 * Automatically extracts user facts, identity details, likes, dislikes, comfort preferences,
 * slang/informal style, and context from natural Portuguese messages so NEXUS AI adapts to each logged-in user.
 */
export function extractUserKnowledge(text: string, profile: UserProfile): UserProfile {
  if (!text || text.trim().length < 2) return profile;

  const clean = text.trim();
  const slangResult = learnUserSlang(
    clean,
    profile.slangTerms || [],
    profile.slangCounts || {}
  );

  if (clean.length < 4 && !slangResult.changed) return profile;

  let updatedName = profile.name;
  let updatedCity = profile.city;
  let updatedVibe = profile.userVibe;
  const liked = [...profile.likedTopics];
  const disliked = [...profile.dislikedTopics];
  const notes = [...profile.notes];

  const addUnique = (arr: string[], item: string, maxLen = 100) => {
    const trimmed = item.trim().slice(0, maxLen);
    if (!trimmed) return;
    const normNew = normalizeText(trimmed);
    if (!arr.some((existing) => normalizeText(existing) === normNew)) {
      arr.unshift(trimmed);
    }
  };

  // Name detection
  const nameMatch = clean.match(
    /\b(?:meu nome [eé]|me chamo|pode me chamar de|sou o|sou a)\s+([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)?)/i
  );
  if (nameMatch && nameMatch[1]) {
    const candidate = nameMatch[1].trim();
    if (candidate.length >= 2 && !/^(que|um|uma|de|do|da|muito)$/i.test(candidate)) {
      updatedName = candidate;
      addUnique(notes, `Nome do usuário: ${candidate}`, 140);
    }
  }

  // City / Location detection
  const cityMatch = clean.match(
    /\b(?:moro em|vivo em|sou de|estou em|minha cidade [eé])\s+([A-Za-zÀ-ÖØ-öø-ÿ\s'-]{2,32})/i
  );
  if (cityMatch && cityMatch[1]) {
    const city = cityMatch[1].replace(/[.,!?]+$/, '').trim();
    if (city.length >= 2) {
      updatedCity = city;
      addUnique(notes, `Localidade do usuário: ${city}`, 140);
    }
  }

  // Profession / studies / projects
  const roleMatch = clean.match(
    /\b(?:trabalho com|trabalho como|sou estudante de|estudo|programo em|estou criando|meu projeto [eé]|fazendo faculdade de)\s+([^.!?\n]{3,70})/i
  );
  if (roleMatch && roleMatch[1]) {
    addUnique(notes, `Área/Projeto: ${roleMatch[0].trim()}`, 140);
  }

  // Likes / Comfort Preferences
  const likeMatch = clean.match(
    /\b(?:eu gosto muito de|eu gosto de|gosto quando|adoro|eu amo|curto muito|curto|prefiro|meu favorito [eé])\s+([^.!?\n]{2,70})/i
  );
  if (likeMatch && likeMatch[1]) {
    const topic = likeMatch[1].trim().replace(/[.,!?]+$/, '');
    if (topic.length >= 2) {
      addUnique(liked, topic, 90);
      addUnique(notes, `Gosta de: ${topic}`, 140);
    }
  }

  // Dislikes / Comfort Boundaries
  const dislikeMatch = clean.match(
    /\b(?:n[aã]o gosto de|n[aã]o gosto quando|odeio|detesto|evit[ae]\s+(?:falar de|usar)?|pare de|me incomoda|n[aã]o curto|n[aã]o quero que)\s+([^.!?\n]{2,70})/i
  );
  if (dislikeMatch && dislikeMatch[1]) {
    const topic = dislikeMatch[1].trim().replace(/[.,!?]+$/, '');
    if (topic.length >= 2) {
      addUnique(disliked, topic, 90);
      addUnique(notes, `Não gosta de: ${topic}`, 140);
    }
  }

  // Communication style preference ("seja mais...", "fale de forma...")
  const styleMatch = clean.match(
    /\b(?:seja mais|fale de forma mais|responda de jeito)\s+([^.!?\n]{3,60})/i
  );
  if (styleMatch && styleMatch[1]) {
    addUnique(notes, `Preferência de estilo: ${styleMatch[0].trim()}`, 140);
  }

  // Explicit remember requests ("lembre que...", "guarda isso...")
  const rememberMatch = clean.match(
    /\b(?:lembre(?:-se)?\s+(?:que|disso)|anota a[ií]|guarde?\s+(?:isso|que)|n[aã]o esquece que)\s*:?\s*([^.!?\n]{4,120})/i
  );
  if (rememberMatch && rememberMatch[1]) {
    addUnique(notes, `Nota solicitada: ${rememberMatch[1].trim()}`, 140);
  }

  // Vibe detection
  if (/\b(haha|kkk+|rsrs|piada|engra[çc]ad|zoeira)\b/i.test(clean)) {
    updatedVibe = 'humorous';
  } else if (/\b(c[oó]digo|api|arquitetura|algoritmo|typescript|python|banco de dados)\b/i.test(clean)) {
    updatedVibe = 'technical';
  }

  return {
    ...profile,
    name: updatedName,
    city: updatedCity,
    userVibe: updatedVibe,
    likedTopics: liked.slice(0, 30),
    dislikedTopics: disliked.slice(0, 30),
    notes: notes.slice(0, 50),
    slangTerms: slangResult.slangTerms,
    slangCounts: slangResult.slangCounts,
  };
}

/**
 * Updates likes/dislikes counters accurately (handling toggles) AND learns
 * what kind of response/topic the user enjoyed or disliked.
 */
export function learnFromFeedback(
  aiContent: string,
  userPrompt: string | undefined,
  nextFeedback: 'like' | 'dislike' | null,
  prevFeedback: 'like' | 'dislike' | null | undefined,
  profile: UserProfile
): UserProfile {
  let likes = profile.totalLikes || 0;
  let dislikes = profile.totalDislikes || 0;

  if (prevFeedback === 'like') likes = Math.max(0, likes - 1);
  if (prevFeedback === 'dislike') dislikes = Math.max(0, dislikes - 1);
  if (nextFeedback === 'like') likes += 1;
  if (nextFeedback === 'dislike') dislikes += 1;

  const likedTopics = [...profile.likedTopics];
  const dislikedTopics = [...profile.dislikedTopics];
  const notes = [...profile.notes];

  const topicPreview = (userPrompt || '').trim().replace(/\s+/g, ' ').slice(0, 55);
  const hasCode = /```[\s\S]*```/.test(aiContent);
  const hasPoll = /```(?:poll|enquete)/i.test(aiContent);
  const isLong = aiContent.length > 900;

  if (nextFeedback === 'like') {
    if (hasPoll && !likedTopics.includes('enquetes interativas')) {
      likedTopics.unshift('enquetes interativas');
    }
    if (hasCode && !likedTopics.includes('exemplos de código práticos')) {
      likedTopics.unshift('exemplos de código práticos');
    }
    if (topicPreview && topicPreview.length >= 4) {
      const label = `Respostas sobre "${topicPreview}"`;
      if (!likedTopics.some((t) => normalizeText(t) === normalizeText(label))) {
        likedTopics.unshift(label);
      }
    }
  } else if (nextFeedback === 'dislike') {
    if (isLong && !dislikedTopics.includes('respostas muito longas')) {
      dislikedTopics.unshift('respostas muito longas');
    }
    if (topicPreview && topicPreview.length >= 4) {
      const label = `Abordagem usada em "${topicPreview}"`;
      if (!dislikedTopics.some((t) => normalizeText(t) === normalizeText(label))) {
        dislikedTopics.unshift(label);
      }
    }
  }

  return {
    ...profile,
    totalLikes: likes,
    totalDislikes: dislikes,
    humorPreference: nextFeedback === 'like' ? true : profile.humorPreference,
    likedTopics: likedTopics.slice(0, 30),
    dislikedTopics: dislikedTopics.slice(0, 30),
    notes: notes.slice(0, 50),
  };
}

/**
 * Builds a smart cross-conversation memory string from ALL past conversations
 * so NEXUS AI can answer questions about older chats and recall prior context.
 */
export function buildCrossConversationMemory(
  currentQuery: string,
  allConversations: Conversation[],
  activeConvId: string | null
): string {
  const otherConvs = allConversations.filter(
    (c) => c.id !== activeConvId && c.messages && c.messages.length > 0
  );

  if (otherConvs.length === 0) return '';

  const queryKeywords = extractKeywords(currentQuery);
  const asksAboutPast =
    /\b(lembr[aeo]|outra conversa|outras conversas|conversa antiga|conversas antigas|conversa passada|conversas passadas|assunto passado|assuntos passados|outro chat|outra vez|outro dia|j[aá] falamos|falamos|conversamos|disse antes|te contei|te falei|eu disse|ontem|semana passada|me conhece|sabe sobre mim|hist[oó]rico|anterior|passado)\b/i.test(
      currentQuery
    );

  const scoredConvs = otherConvs.map((conv) => {
    let score = 0;
    const matchedMessages: Array<{ role: string; text: string; time: string; msgScore: number; idx: number }> = [];

    const normTitle = normalizeText(conv.title);
    for (const kw of queryKeywords) {
      if (normTitle.includes(kw)) score += 5;
    }

    conv.messages.forEach((m, idx) => {
      if (!m.content || m.error) return;
      const normContent = normalizeText(m.content);
      let msgScore = 0;

      for (const kw of queryKeywords) {
        if (normContent.includes(kw)) {
          msgScore += 3;
        }
      }

      if (m.role === 'user') msgScore += 0.6;
      if (idx >= conv.messages.length - 4) msgScore += 0.5;
      if (idx === 0) msgScore += 0.4;

      if (msgScore >= 3 || asksAboutPast) {
        matchedMessages.push({
          role: m.role === 'user' ? 'Usuário' : 'NEXUS',
          text: m.content.replace(/\s+/g, ' ').slice(0, asksAboutPast ? 300 : 240),
          time: new Date(m.timestamp).toLocaleString('pt-BR', {
            dateStyle: 'short',
            timeStyle: 'short',
          }),
          msgScore,
          idx,
        });
      }
      score += msgScore;
    });

    const ageHours = (Date.now() - conv.updatedAt) / (1000 * 60 * 60);
    if (ageHours < 24) score += 2.5;
    else if (ageHours < 168) score += 1.2;

    matchedMessages.sort((a, b) => b.msgScore - a.msgScore || b.idx - a.idx);

    return {
      conv,
      score,
      matchedMessages: matchedMessages.slice(0, asksAboutPast ? 4 : 3),
    };
  });

  scoredConvs.sort((a, b) => b.score - a.score || b.conv.updatedAt - a.conv.updatedAt);

  const lines: string[] = [];
  let charBudget = asksAboutPast ? 4200 : 950;

  const topRelevant = scoredConvs.slice(0, asksAboutPast ? 7 : 3);
  for (const item of topRelevant) {
    if (charBudget <= 200) break;
    const dateStr = new Date(item.conv.updatedAt).toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
    const header = `• Conversa "${item.conv.title}" (${dateStr}, ${item.conv.messages.length} msgs):`;
    lines.push(header);
    charBudget -= header.length;

    const msgsToShow =
      item.matchedMessages.length > 0
        ? item.matchedMessages.slice(0, asksAboutPast ? 4 : 2)
        : item.conv.messages
            .filter((m) => !m.error && m.content)
            .slice(asksAboutPast ? -3 : -2)
            .map((m, idx) => ({
              role: m.role === 'user' ? 'Usuário' : 'NEXUS',
              text: m.content.replace(/\s+/g, ' ').slice(0, asksAboutPast ? 220 : 130),
              time: '',
              msgScore: 0,
              idx,
            }));

    for (const msg of msgsToShow) {
      const entry = `   - [${msg.role}]: ${msg.text.slice(0, asksAboutPast ? 260 : 130)}`;
      if (charBudget - entry.length < 80) break;
      lines.push(entry);
      charBudget -= entry.length;
    }
  }

  if (scoredConvs.length > 6 && charBudget > 250) {
    const restTitles = scoredConvs
      .slice(6, 16)
      .map((s) => `"${s.conv.title}"`)
      .join(', ');
    lines.push(`• Outras conversas no histórico: ${restTitles}`);
  }

  return lines.join('\n');
}
