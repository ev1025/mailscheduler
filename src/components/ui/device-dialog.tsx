"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import DraggableSheet from "@/components/ui/draggable-sheet";
import { useMediaQuery } from "@/lib/use-media-query";

// 모바일(<768px) = 바텀시트(스냅 드래그) / 데스크탑(>=768px) = 중앙 Dialog.

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** 데스크탑 Dialog 의 max-width 클래스. 기본 "max-w-lg" */
  desktopMaxWidth?: string;
  /** 모바일 스냅 지점 (뷰포트 높이 비율). 기본 [0.5, 0.9] */
  snapPoints?: number[];
  /** 초기 스냅 인덱스. 기본 최대치(닫기 직전 90% 등) */
  defaultSnapIndex?: number;
  /** 내부 스크롤 래퍼 여부 */
  scrollable?: boolean;
  children: React.ReactNode;
}

export default function DeviceDialog({
  open,
  onOpenChange,
  title,
  desktopMaxWidth = "max-w-lg",
  snapPoints = [0.5, 0.9],
  defaultSnapIndex,
  scrollable = true,
  children,
}: Props) {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={desktopMaxWidth}>
          <DialogHeader>
            <DialogTitle className="text-base">{title}</DialogTitle>
          </DialogHeader>
          {scrollable ? (
            <div className="max-h-[70vh] overflow-y-auto overscroll-contain">
              {children}
            </div>
          ) : (
            children
          )}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <DraggableSheet
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      snapPoints={snapPoints}
      defaultSnapIndex={defaultSnapIndex}
      scrollable={scrollable}
    >
      {children}
    </DraggableSheet>
  );
}
