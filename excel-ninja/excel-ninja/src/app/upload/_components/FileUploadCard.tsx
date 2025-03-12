'use client';

export default function FileUploadCard() {
  return (
    <div className="border rounded-lg p-6">
      <h2 className="text-xl font-semibold mb-4">上传文件</h2>
      <div className="border-dashed border-2 rounded-lg p-8 text-center">
        <p>拖放Excel/CSV文件到这里或点击上传</p>
        <input
          type="file"
          className="hidden"
          accept=".xlsx,.xls,.csv"
          onChange={(e) => console.log(e.target.files)}
        />
      </div>
    </div>
  );
}