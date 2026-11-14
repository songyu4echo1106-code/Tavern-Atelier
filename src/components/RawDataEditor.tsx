import { useEffect, useState } from 'react';
import { Check, RotateCcw } from 'lucide-react';
import { Button } from './UI';

export default function RawDataEditor({ data, onChange }: { data: Record<string, unknown>; onChange: (data: Record<string, unknown>) => void }) {
  const [text, setText] = useState(JSON.stringify(data, null, 2));
  const [error, setError] = useState('');
  useEffect(() => { setText(JSON.stringify(data, null, 2)); setError(''); }, [data]);
  const apply = () => {
    try {
      const parsed = JSON.parse(text) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('顶层必须是 JSON 对象');
      onChange(parsed as Record<string, unknown>);
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  };
  return <div className="raw-editor"><div className="raw-notice"><div><strong>原始数据与未知字段</strong><p>结构化编辑器不会主动清理这里未识别的字段。高级修改请先保存版本。</p></div><div><Button icon={<RotateCcw size={14} />} onClick={() => setText(JSON.stringify(data, null, 2))}>重置</Button><Button variant="primary" icon={<Check size={14} />} onClick={apply}>应用 JSON</Button></div></div>{error && <div className="error-banner">{error}</div>}<textarea className="code-editor" spellCheck={false} value={text} onChange={(event) => setText(event.target.value)} /></div>;
}
