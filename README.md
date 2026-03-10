# 石墨到金刚石转化模拟器 (Graphite to Diamond Transformation Simulator)

这是一个基于 React, Three.js 和 Tailwind CSS 构建的交互式 3D 模拟器，展示了碳原子在极端高温高压下从石墨结构转化为金刚石结构的过程。

## 功能特点

- **3D 交互模拟**：实时展示原子位置的动态迁移。
- **环境参数控制**：通过滑块调节温度和压力强度。
- **多层结构支持**：支持 1 到 5 层的石墨烯堆叠模拟。
- **精确测量**：在 1-2 层模式下提供实时键长和层间距测量。
- **多视角切换**：支持 ISO、俯视和正视（水平层显示）视角。

## 本地开发

1. **克隆仓库**:
   ```bash
   git clone <your-repo-url>
   cd <repo-name>
   ```

2. **安装依赖**:
   ```bash
   npm install
   ```

3. **启动开发服务器**:
   ```bash
   npm run dev
   ```

4. **构建生产版本**:
   ```bash
   npm run build
   ```

## 部署到 GitHub Pages

项目已配置 GitHub Actions 自动部署。

1. 将代码推送到 GitHub 的 `main` 分支。
2. 在 GitHub 仓库设置中：
   - 进入 **Settings** > **Pages**。
   - 在 **Build and deployment** > **Source** 下选择 **GitHub Actions**。
3. 每次推送代码后，工作流会自动构建并部署到 `https://<username>.github.io/<repo-name>/`。

## 技术栈

- **React 19**
- **Three.js / React Three Fiber** (3D 渲染)
- **Tailwind CSS 4** (样式)
- **Motion** (动画)
- **Vite** (构建工具)
