import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const userId = formData.get('userId') as string;

    // 创建初始记录
    const history = await prisma.fileHistory.create({
      data: {
        userId,
        fileName: file.name,
        fileType: file.type,
        status: 'PROCESSING'
      }
    });

    // 模拟文件处理（实际应包含业务逻辑）
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 更新处理结果
    await prisma.fileHistory.update({
      where: { id: history.id },
      data: {
        status: 'COMPLETED',
        resultUrl: '/processed-files/' + file.name
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Upload error:', error);
    await prisma.fileHistory.update({
      where: { id: history.id },
      data: { status: 'FAILED' }
    });
    return NextResponse.json(
      { error: '文件处理失败' },
      { status: 500 }
    );
  }
}