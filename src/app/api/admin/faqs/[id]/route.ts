import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiAccess } from '@/lib/adminHelpers';
import { FAQAdminService } from '@/features/admin/services/faqAdminService';
import { UpdateFAQData } from '@/types/faq';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { auth, response } = await requireAdminApiAccess(request);
    if (response) return response;

    const { id } = await params;
    const service = new FAQAdminService();
    const faq = await service.getById(id);

    if (!faq) {
      return NextResponse.json(
        { error: 'FAQ not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(faq);
  } catch (error) {
    console.error('Error fetching FAQ:', error);
    return NextResponse.json(
      { error: 'Failed to fetch FAQ' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { auth, response } = await requireAdminApiAccess(request);
    if (response) return response;

    const { id } = await params;
    const body: UpdateFAQData = await request.json();

    // Validate answer length if provided
    if (body.answer !== undefined && body.answer !== null && body.answer.length > 10000) {
      return NextResponse.json(
        { error: 'Answer must be 10000 characters or less' },
        { status: 400 }
      );
    }

    // Validate question length if provided
    if (body.question !== undefined && body.question !== null && body.question.length > 2000) {
      return NextResponse.json(
        { error: 'Question must be 2000 characters or less' },
        { status: 400 }
      );
    }

    const service = new FAQAdminService();
    const faq = await service.update(id, body);

    return NextResponse.json(faq);
  } catch (error) {
    console.error('Error updating FAQ:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update FAQ' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { auth, response } = await requireAdminApiAccess(request);
    if (response) return response;

    const { id } = await params;
    const service = new FAQAdminService();
    await service.delete(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting FAQ:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete FAQ' },
      { status: 500 }
    );
  }
}
