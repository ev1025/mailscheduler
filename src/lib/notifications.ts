export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: "warning" | "info";
  date: string;
}

export function getNotifications(): AppNotification[] {
  const notifications: AppNotification[] = [];
  const today = new Date();

  // 기상청 API 만료일 (2028-04-12)
  const kmaExpiry = new Date("2028-04-12");
  const daysUntilExpiry = Math.ceil((kmaExpiry.getTime() - today.getTime()) / 86400000);

  if (daysUntilExpiry <= 30 && daysUntilExpiry > 0) {
    notifications.push({
      id: "kma-expiry",
      title: "기상청 API 키 만료 임박",
      message: `기상청 API 키가 ${daysUntilExpiry}일 후 만료됩니다.\n\n갱신 방법:\n1. https://www.data.go.kr 접속 (네이버 간편로그인)\n2. 마이페이지 → API 활용신청 현황\n3. 단기예보: VilageFcstInfoService_2.0\n4. 중기예보: MidFcstInfoService\n5. 각각 연장 신청\n\n만료일: 2028-04-12`,
      type: "warning",
      date: "2028-04-12",
    });
  } else if (daysUntilExpiry <= 0) {
    notifications.push({
      id: "kma-expired",
      title: "기상청 API 키 만료됨",
      message: `기상청 API 키가 만료되었습니다.\n\nhttps://www.data.go.kr 에서 갱신해주세요.\n(네이버 간편로그인)\n\n단기예보: VilageFcstInfoService_2.0\n중기예보: MidFcstInfoService`,
      type: "warning",
      date: "2028-04-12",
    });
  }

  return notifications;
}
