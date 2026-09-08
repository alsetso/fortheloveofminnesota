import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import DespiaAppFrame from '@/components/despia/DespiaAppFrame';
import {
  getCurrentPolicyVersion,
  IOS2_LEGAL_PLATFORM,
  type LegalPolicySlug,
} from '@/lib/legal';

function formatDate(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    });
  } catch {
    return iso;
  }
}

export async function LegalPolicyPage({
  slug,
  heading,
}: {
  slug: LegalPolicySlug;
  heading: string;
}) {
  const version = await getCurrentPolicyVersion(slug, IOS2_LEGAL_PLATFORM);

  return (
    <DespiaAppFrame scroll style={{ backgroundColor: '#F5F0E8' }} contentClassName="px-5 py-6">
      <p className="text-[11px] font-medium uppercase tracking-wide text-[#7A736C]">
        {heading}
        {version.version_label ? ` · v${version.version_label}` : ''}
        {version.platform && version.platform !== 'all' ? ` · ${version.platform}` : ''}
      </p>
      <p className="mt-1 text-xs text-[#7A736C]">
        Effective {formatDate(version.effective_at)}
        {version.summary ? ` — ${version.summary}` : ''}
      </p>

      <article className="legal-md mt-5 text-sm leading-relaxed text-[#2C2825]">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ children }) => (
              <h1 className="mb-3 text-xl font-semibold text-[#2C2825]">{children}</h1>
            ),
            h2: ({ children }) => (
              <h2 className="mb-2 mt-6 text-base font-semibold text-[#2C2825]">{children}</h2>
            ),
            h3: ({ children }) => (
              <h3 className="mb-1.5 mt-4 text-sm font-semibold text-[#2C2825]">{children}</h3>
            ),
            p: ({ children }) => <p className="mb-3 text-[#3D3833]">{children}</p>,
            ul: ({ children }) => (
              <ul className="mb-3 list-disc space-y-1.5 pl-5 text-[#3D3833]">{children}</ul>
            ),
            ol: ({ children }) => (
              <ol className="mb-3 list-decimal space-y-1.5 pl-5 text-[#3D3833]">{children}</ol>
            ),
            li: ({ children }) => <li className="leading-relaxed">{children}</li>,
            strong: ({ children }) => (
              <strong className="font-semibold text-[#2C2825]">{children}</strong>
            ),
            a: ({ href, children }) => (
              <a
                href={href}
                className="font-medium text-[#2F5D4A] underline underline-offset-2"
                target={href?.startsWith('http') ? '_blank' : undefined}
                rel={href?.startsWith('http') ? 'noreferrer' : undefined}
              >
                {children}
              </a>
            ),
          }}
        >
          {version.content_md}
        </ReactMarkdown>
      </article>

      <Link href="/welcome" className="mt-8 inline-block text-sm font-medium text-[#2F5D4A] underline">
        Back to welcome
      </Link>
    </DespiaAppFrame>
  );
}
