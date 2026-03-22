import { MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function AiChatAssistant() {
  const navigate = useNavigate();

  return (
    <Button
      variant="outline"
      className="gap-2 border-purple-200 bg-white/90 hover:bg-purple-50 hover:text-purple-700"
      onClick={() => navigate('/ai-chat')}
    >
      <MessageCircle className="h-4 w-4" />
      <span className="hidden md:inline">AI Chat</span>
    </Button>
  );
}
