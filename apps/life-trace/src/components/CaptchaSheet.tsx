import { ClawCaptcha } from 'playcaptcha';
import 'playcaptcha/clawcaptcha.css';
import { useCallback, useEffect, useRef } from 'react';
import { BottomSheet } from '@/components/BottomSheet';

const TOY_LABELS: Record<string, string> = {
  duck: '小黄鸭',
  bear: '小熊',
  panda: '熊猫',
  bunny: '兔子',
  dino: '恐龙',
  penguin: '企鹅',
  fox: '狐狸',
  frog: '青蛙',
  whale: '鲸鱼',
  cat: '小猫',
  puppy: '小狗',
  unicorn: '独角兽',
};

interface CaptchaSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerify: () => void;
}

export function CaptchaSheet({ open, onOpenChange, onVerify }: CaptchaSheetProps) {
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      overlayLabel="关闭人机验证"
      showHandle={false}
      closeDisabled
      contentClassName="flex items-center justify-center !px-0 !pt-0 !pb-4"
    >
      <ChineseClawCaptcha
        onVerify={() => {
          onVerify();
          onOpenChange(false);
        }}
      />
    </BottomSheet>
  );
}

function ChineseClawCaptcha({ onVerify }: { onVerify: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const processedRef = useRef<Set<Node>>(new Set());
  const restructuredRef = useRef(false);

  const restructureSub = useCallback(() => {
    if (!containerRef.current || restructuredRef.current) return;
    const sub = containerRef.current.querySelector('.clawcap-sub');
    if (!sub) return;

    const img = sub.querySelector('.clawcap-sub-toy') as HTMLElement | null;
    if (!img) return;

    const nodes = Array.from(sub.childNodes);
    const imgIndex = nodes.indexOf(img);

    const line1Nodes = nodes.slice(0, imgIndex).filter((n) => {
      if (n.nodeType === Node.TEXT_NODE) return (n.textContent || '').trim().length > 0;
      return true;
    });
    const line2Nodes = nodes.slice(imgIndex);

    if (line1Nodes.length === 0) return;

    const line1 = document.createElement('span');
    line1.className = 'clawcap-sub-line1';
    line1Nodes.forEach((n) => {
      sub.removeChild(n);
      line1.appendChild(n);
    });

    const line2 = document.createElement('span');
    line2.className = 'clawcap-sub-line2';
    line2Nodes.forEach((n) => {
      sub.removeChild(n);
      line2.appendChild(n);
    });

    sub.appendChild(line1);
    sub.appendChild(line2);
    restructuredRef.current = true;
  }, []);

  useEffect(() => {
    const replaceTextInNode = (node: Node) => {
      if (node.nodeType !== Node.TEXT_NODE) return;
      if (processedRef.current.has(node)) return;

      let text = node.textContent || '';
      if (!text.trim()) return;

      const originalText = text;

      text = text.replace(/Use the claw to pick up the/i, '使用爪机抓取');
      text = text.replace(/Verified/i, '已验证');
      text = text.replace(/You're human\. Nice catch\./i, '验证成功，太棒了！');
      text = text.replace(/Came up empty\. Try again\./i, '没有抓到玩具，请重试');
      text = text.replace(/Move the toy over the drop zone first\./i, '请先将玩具移动到投放区域');
      text = text.replace(/Drop here/i, '投放区域');
      text = text.replace(/Release!/i, '投放！');
      text = text.replace(/Nice catch!/i, '抓到了！');
      text = text.replace(/Hmm, wrong toy/i, '不是这个玩具');
      text = text.replace(/Grab/i, '抓取');
      text = text.replace(/Drop/i, '投放');
      text = text.replace(/Got it/i, '知道了');
      text = text.replace(/About PlayCaptcha/i, '关于验证');
      text = text.replace(/Catch the right toy to prove you're human\./i, '抓取正确的玩具完成验证');
      text = text.replace(
        /Line the claw up right over your prize — joystick or/i,
        '将爪机对准目标玩具 — 使用摇杆或',
      );
      text = text.replace(
        /Commit\. The claw dives, bites and hauls it up — red button or/i,
        '确认抓取。爪机会下落、抓取并提起 — 点击红色按钮或',
      );
      text = text.replace(
        /Ferry it to the hatch and let go\. Wrong toy\? Straight back on the pile/i,
        '将玩具移动到投放口并释放。抓错了？玩具会回到堆里',
      );
      text = text.replace(
        /Joystick or — to move · Space to grab & drop/i,
        '使用摇杆或方向键移动 · 空格键抓取/投放',
      );

      for (const [key, value] of Object.entries(TOY_LABELS)) {
        text = text.replace(new RegExp(`\\b${key}\\b`, 'gi'), value);
      }

      text = text.replace(/yellow duck/i, '小黄鸭');
      text = text.replace(/teddy bear/i, '小熊');

      if (text !== originalText) {
        node.textContent = text;
        processedRef.current.add(node);
      }
    };

    const replaceText = () => {
      if (!containerRef.current) return;

      const walker = document.createTreeWalker(containerRef.current, NodeFilter.SHOW_TEXT);

      let node: Node | null = walker.nextNode();
      while (node) {
        replaceTextInNode(node);
        node = walker.nextNode();
      }

      restructureSub();
    };

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'characterData') {
          replaceTextInNode(mutation.target);
        } else if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((addedNode) => {
            if (addedNode.nodeType === Node.TEXT_NODE) {
              replaceTextInNode(addedNode);
            } else if (addedNode.nodeType === Node.ELEMENT_NODE) {
              const walker = document.createTreeWalker(addedNode as Element, NodeFilter.SHOW_TEXT);
              let textNode: Node | null = walker.nextNode();
              while (textNode) {
                replaceTextInNode(textNode);
                textNode = walker.nextNode();
              }
            }
          });
        }
      });

      restructureSub();
    });

    if (containerRef.current) {
      observer.observe(containerRef.current, {
        subtree: true,
        childList: true,
        characterData: true,
      });
      replaceText();
    }

    return () => {
      observer.disconnect();
      processedRef.current.clear();
      restructuredRef.current = false;
    };
  }, [restructureSub]);

  return (
    <div ref={containerRef} className="captcha-chinese">
      <ClawCaptcha title="请完成验证" onVerify={onVerify} />
    </div>
  );
}
