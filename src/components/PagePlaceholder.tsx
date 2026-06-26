// 아직 구현되지 않은 페이지용 자리표시 카드.
// 다음 세션에서 각 화면을 실제 구현으로 교체한다.

export default function PagePlaceholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
      <p className="text-lg font-medium text-gray-900">{title}</p>
      <p className="mt-2 text-sm text-gray-500">{description}</p>
      <span className="mt-4 inline-block rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-400">
        준비 중
      </span>
    </div>
  );
}
