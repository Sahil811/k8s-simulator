# ☸️ Kubernetes Simulator: High-Fidelity Learning Engine

[![Vite](https://img.shields.io/badge/vite-%23646CFF.svg?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

> Transition from theoretical knowledge to **deep mechanical intuition**.

The **Kubernetes Simulator** is a visual, fully interactive replica of the Kubernetes Control Plane. It's designed to help engineers understand how Kubernetes operates, breaks, and recovers by providing a sandboxed environment where every action in the `kubectl` terminal triggers a real-time reconciliation loop in a simulated cluster.

---

## 🚀 Key Modules

Each module is designed to isolate and teach specific Kubernetes domains:

| Module | Description |
| :--- | :--- |
| **Overview** | High-level visualization of the Control Plane and Worker Nodes. |
| **Control Plane** | Deep dive into the API Server, etcd, Scheduler, and Controller Manager. |
| **Workloads** | Interactive management of Deployments, ReplicaSets, and Pods. |
| **Networking** | Visualizing Services, Selectors, Endpoints, and Traffic flow. |
| **Storage** | Managing PVCs, PVs, and dynamic provisioning. |
| **Scaling** | Hands-on with HPA and cluster elasticity. |
| **RBAC** | Visualizing Roles, RoleBindings, and ServiceAccounts. |
| **Scenarios** | A library of 12 real-world failure modes to diagnose and solve. |

---

## 🔥 "God-Tier" Interactivity

Go beyond standard tutorials with features built for advanced engineering:

### 🔬 X-Ray Matrix Mode
Visualize cluster traffic and component interactions in real-time. See exactly how requests flow from the API Server to the Kubelets.

### ⏳ Time Travel Debugger
Replay your failures. Watch step-by-step as the controllers detect a delta between "Desired State" and "Current State" and work to resolve it.

### 🛠️ High-Fidelity Reconciler
The core engine is a true implementation of the Kubernetes reconciliation pattern. It's not just a UI; it's a living model of the K8s control loop.

---

## 📚 Structured Learning Path

The simulator includes a [Level-by-Level Syllabus](file:///d:/4800h/code/k8s-simulator/k8s_learning_guide.md) that takes you from beginner concepts to CKS-level troubleshooting:

1.  **Green Phase**: Anatomy of a Cluster & The Core Reconciliation Loop.
2.  **Yellow Phase**: Scheduling (Filter & Score), Taints, and CrashLoopBackOffs.
3.  **Orange Phase**: Networking, Services, and Node Failures.
4.  **Red Phase**: Persistent Storage, StatefulSets, and DaemonSets.
5.  **Capstone**: Solve all 12 scenarios to achieve "Mechanical Empathy" for K8s clusters.

---

## 🛠️ Tech Stack

- **Framework**: [React 19](https://react.dev/)
- **Build Tool**: [Vite 8](https://vitejs.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Diagrams**: [ReactFlow](https://reactflow.dev/) (for interactive node-based visualizations)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand) + [Immer](https://immerjs.github.io/immer/)
- **Editor**: [@monaco-editor/react](https://github.com/suren-atoyan/monaco-react) (High-fidelity YAML editing)
- **Icons & UI**: [Lucide React](https://lucide.dev/) & [Canvas Confetti](https://www.npmjs.com/package/canvas-confetti)

---

## 🏁 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/Sahil811/k8s-simulator.git
    cd k8s-simulator
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Start the development server:
    ```bash
    npm run dev
    ```

4.  Open your browser and navigate to `http://localhost:5173`.

---

## 🏗️ Project Structure

- `src/engine`: The core reconciliation engine (`reconciler.ts`) and worker logic.
- `src/store`: Zustand stores for simulator state and user progress.
- `src/modules`: Individual educational modules (Overview, Workloads, etc.).
- `src/components`: UI components including the `kubectl` terminal and YAML editor.
- `src/types`: TypeScript definitions for K8s resources and simulator state.

---

## 🤝 Contributing

We welcome contributions to the Scenario Library! If you have a gnarly production outage you'd like to simulate, please open a PR.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
