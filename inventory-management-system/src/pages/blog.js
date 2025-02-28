import { promises as fs } from 'fs';
import path from 'path';

function Blog({ posts }) {
  return (
    <ul>
      {posts.map((post) => (
        <li key={post.filename}>
          <h3>{post.filename}</h3>
          <p>{post.content}</p>
        </li>
      ))}
    </ul>
  );
}

export async function getStaticProps() {
  const postDir = path.resolve(process.cwd(), 'posts');
  const filenames = await fs.readdir(postDir);

  const posts = filenames.map(async (filename) => {
    const filePath = path.resolve(postDir, filename);
    const fileContents = await fs.readFile(filePath, 'utf-8');

    return {
      filename,
      content: fileContents,
    };
  });

  return {
    props: {
      posts: await Promise.all(posts),
    },
  };
}

export default Blog;
