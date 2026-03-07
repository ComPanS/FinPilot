const PROFILE_URL = "https://login.yandex.ru/info?format=json";

export interface YandexProfile {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export async function fetchYandexProfile(
  accessToken: string
): Promise<YandexProfile> {
  const response = await fetch(PROFILE_URL, {
    headers: {
      Authorization: `OAuth ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch Yandex profile");
  }

  const data = (await response.json()) as {
    id: string;
    default_email?: string;
    real_name?: string;
    default_avatar_id?: string;
  };

  const avatarUrl = data.default_avatar_id
    ? `https://avatars.yandex.net/get-yapic/${data.default_avatar_id}/islands-200`
    : null;

  return {
    id: data.id,
    email: data.default_email ?? "",
    displayName: data.real_name ?? null,
    avatarUrl,
  };
}
